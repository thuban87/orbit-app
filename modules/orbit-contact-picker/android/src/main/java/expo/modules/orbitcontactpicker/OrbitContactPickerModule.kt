package expo.modules.orbitcontactpicker

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.ContactsContract
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream

// API 37's constants are deliberately string literals so this local module can
// compile on the existing Expo toolchain. The runtime SDK check below ensures
// older Android versions never launch this Android-17-only activity.
private const val ACTION_PICK_CONTACTS = "android.provider.action.PICK_CONTACTS"
// NOTE: the platform ContactsPicker trampoline reads USE_SYSTEM_CONTACTS_PICKER
// under the `android.intent.extra.*` namespace (verified by disassembling
// /system/priv-app/ContactsPicker on raven/17). The prior `android.provider.extra.*`
// key was silently ignored -> the trampoline defaulted the flag to false and
// forwarded to a non-existent preferred picker ("No PreferredActivity Found").
private const val EXTRA_USE_SYSTEM_CONTACTS_PICKER =
  "android.intent.extra.USE_SYSTEM_CONTACTS_PICKER"
private const val EXTRA_PICK_CONTACTS_REQUESTED_DATA_FIELDS =
  "android.provider.extra.PICK_CONTACTS_REQUESTED_DATA_FIELDS"
private const val EXTRA_PICK_CONTACTS_SELECTION_LIMIT =
  "android.provider.extra.PICK_CONTACTS_SELECTION_LIMIT"
private const val PICK_CONTACTS_CODE = 9472

internal class ContactPickInProgressException :
  CodedException("A system contact picker request is already in progress.")

internal class ContactPickLaunchException :
  CodedException("Unable to start the system contact picker.")

internal class ContactReadException :
  CodedException("Unable to read contacts.")

private data class MutablePickedContact(
  val lookupKey: String,
  var displayName: String? = null,
  val methods: MutableList<Map<String, Any?>> = mutableListOf(),
  var birthday: String? = null,
  var note: String? = null,
  var photoTempUri: String? = null,
  // D-133: the thumbnail copy, only when photoTempUri holds the full-size copy.
  var thumbnailTempUri: String? = null,
  // D-132: SHA-256 of the thumbnail bytes (else full-size); stable across D-118.
  var photoFingerprint: String? = null,
  // 38.12 review B-WR-06: the first Event row whose TYPE could not be read
  // (picker session without DATA2). Used only when no row reads as a birthday.
  var birthdayFallback: String? = null,
) {
  /** The one bridge shape every reader returns (photoFingerprint + thumbnailTempUri included). */
  fun toBridgeMap(): Map<String, Any?> = mapOf(
    "lookupKey" to lookupKey,
    "displayName" to displayName,
    "methods" to methods,
    "birthday" to (birthday ?: birthdayFallback),
    "note" to note,
    "photoTempUri" to photoTempUri,
    "thumbnailTempUri" to thumbnailTempUri,
    "photoFingerprint" to photoFingerprint,
  )
}

private data class MutableContactSummary(
  val lookupKey: String,
  val displayName: String?,
  val methods: MutableList<String> = mutableListOf(),
  val photoThumbUri: String? = null,
)

/**
 * Android 17's privacy-preserving Contact Picker wrapper. It receives only the
 * temporary session URI from Android, snapshots permitted data immediately,
 * and returns plain values plus app-owned `file://` cache photo copies to JS.
 */
class OrbitContactPickerModule : Module() {
  private var pendingPickPromise: Promise? = null

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("OrbitContactPicker")

    Function("isContactPickerAvailable") {
      Build.VERSION.SDK_INT >= 37
    }

    AsyncFunction("pickContacts") { options: Map<String, Any?>, promise: Promise ->
      if (pendingPickPromise != null) {
        throw ContactPickInProgressException()
      }
      if (Build.VERSION.SDK_INT < 37) {
        promise.resolve(emptyList<Map<String, Any?>>())
        return@AsyncFunction
      }

      val multiple = options["multiple"] as? Boolean ?: false
      val intent = Intent(ACTION_PICK_CONTACTS).apply {
        putExtra(EXTRA_USE_SYSTEM_CONTACTS_PICKER, true)
        putStringArrayListExtra(
          EXTRA_PICK_CONTACTS_REQUESTED_DATA_FIELDS,
          arrayListOf(
            ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE,
            ContactsContract.CommonDataKinds.Email.CONTENT_ITEM_TYPE,
            ContactsContract.CommonDataKinds.Event.CONTENT_ITEM_TYPE,
            // Note is NOT requestable: the API-37 system picker rejects the whole
            // intent ("unsupported mimetype") and closes. Notes are read after the
            // pick via readContactsByLookupKeys under READ_CONTACTS instead (ADR-154).
            ContactsContract.CommonDataKinds.Photo.CONTENT_ITEM_TYPE,
          ),
        )
        if (multiple) {
          putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
          // The trampoline validates SELECTION_LIMIT (1..100) for multi-select.
          putExtra(EXTRA_PICK_CONTACTS_SELECTION_LIMIT, 100)
        }
      }
      pendingPickPromise = promise
      try {
        appContext.throwingActivity.startActivityForResult(intent, PICK_CONTACTS_CODE)
      } catch (_: Exception) {
        pendingPickPromise = null
        promise.reject(ContactPickLaunchException())
      }
    }

    AsyncFunction("readAllContacts") { promise: Promise ->
      try {
        promise.resolve(readAllContacts())
      } catch (_: Exception) {
        // A failed provider read is distinct from a user cancelling a picker.
        // Do not expose provider details or contact data to JavaScript.
        promise.reject(ContactReadException())
      }
    }

    AsyncFunction("listContactsSummary") { promise: Promise ->
      try {
        promise.resolve(listContactsSummary())
      } catch (_: Exception) {
        // Keep provider details and contact contents out of JS/log output.
        promise.reject(ContactReadException())
      }
    }

    // D-137: preferFullSize is true only on import reads; Check linked contacts
    // passes false and keeps today's thumbnail-first bytes.
    AsyncFunction("readContactsByLookupKeys") { lookupKeys: List<String>, preferFullSize: Boolean, promise: Promise ->
      try {
        promise.resolve(readContactsByLookupKeys(lookupKeys, preferFullSize))
      } catch (_: Exception) {
        // A provider error is distinct from a selected contact that disappeared.
        promise.reject(ContactReadException())
      }
    }

    OnActivityResult { _, (requestCode, resultCode, resultIntent) ->
      if (requestCode != PICK_CONTACTS_CODE) {
        return@OnActivityResult
      }
      val promise = pendingPickPromise ?: return@OnActivityResult
      pendingPickPromise = null

      val sessionUri = if (resultCode == Activity.RESULT_OK) resultIntent?.data else null
      if (sessionUri == null) {
        promise.resolve(emptyList<Map<String, Any?>>())
        return@OnActivityResult
      }

      try {
        promise.resolve(readPickedContacts(sessionUri))
      } catch (_: Exception) {
        // Do not surface temporary provider paths or details into JavaScript.
        promise.resolve(emptyList<Map<String, Any?>>())
      }
    }
  }

  private fun readPickedContacts(sessionUri: Uri): List<Map<String, Any?>> {
    val projection = arrayOf(
      ContactsContract.Data.LOOKUP_KEY,
      ContactsContract.Contacts.DISPLAY_NAME_PRIMARY,
      ContactsContract.Data.MIMETYPE,
      ContactsContract.Data.DATA1,
      // D-102: phone/email TYPE and LABEL. Standard Data columns the API-37
      // session URI is expected to return (RESEARCH A1); a missing column reads
      // as null through stringAt/intAt.
      ContactsContract.Data.DATA2,
      ContactsContract.Data.DATA3,
      ContactsContract.Data.DATA15,
    )
    val contacts = linkedMapOf<String, MutablePickedContact>()

    // Picker session URIs reject selection and selectionArgs. Read only the
    // temporary, OS-granted table and group its data rows by lookup key.
    // RESEARCH A1 (DATA2/DATA3 on the session URI) is unverified (38.12 review
    // B-WR-06): if the session rejects the projection, read again without
    // them, so a pick never imports nothing; labels and event types then read
    // as unknown.
    val sessionCursor = try {
      context.contentResolver.query(sessionUri, projection, null, null, null)
    } catch (_: IllegalArgumentException) {
      context.contentResolver.query(
        sessionUri,
        projection.filterNot {
          it == ContactsContract.Data.DATA2 || it == ContactsContract.Data.DATA3
        }.toTypedArray(),
        null,
        null,
        null,
      )
    }
    sessionCursor?.use { cursor ->
      val lookupKeyColumn = cursor.getColumnIndex(ContactsContract.Data.LOOKUP_KEY)
      val displayNameColumn = cursor.getColumnIndex(ContactsContract.Contacts.DISPLAY_NAME_PRIMARY)
      val mimeTypeColumn = cursor.getColumnIndex(ContactsContract.Data.MIMETYPE)
      val data1Column = cursor.getColumnIndex(ContactsContract.Data.DATA1)
      val data2Column = cursor.getColumnIndex(ContactsContract.Data.DATA2)
      val data3Column = cursor.getColumnIndex(ContactsContract.Data.DATA3)
      val data15Column = cursor.getColumnIndex(ContactsContract.Data.DATA15)

      while (cursor.moveToNext()) {
        val lookupKey = cursor.stringAt(lookupKeyColumn) ?: continue
        val contact = contacts.getOrPut(lookupKey) { MutablePickedContact(lookupKey) }
        contact.displayName = contact.displayName ?: cursor.stringAt(displayNameColumn)

        when (cursor.stringAt(mimeTypeColumn)) {
          ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE ->
            // getTypeLabel is deliberately not used (localized); the TS
            // consumer maps codes to Orbit's labels (38.12-19).
            cursor.stringAt(data1Column)?.takeIf { it.isNotBlank() }?.let { value ->
              // D-102: raw TYPE (DATA2) and LABEL (DATA3); null when absent.
              contact.methods += mapOf(
                "type" to "phone",
                "value" to value,
                "typeCode" to cursor.intAt(data2Column),
                "customLabel" to cursor.stringAt(data3Column)?.takeIf { it.isNotBlank() },
              )
            }
          ContactsContract.CommonDataKinds.Email.CONTENT_ITEM_TYPE ->
            cursor.stringAt(data1Column)?.takeIf { it.isNotBlank() }?.let { value ->
              // D-102: raw TYPE (DATA2) and LABEL (DATA3); null when absent.
              contact.methods += mapOf(
                "type" to "email",
                "value" to value,
                "typeCode" to cursor.intAt(data2Column),
                "customLabel" to cursor.stringAt(data3Column)?.takeIf { it.isNotBlank() },
              )
            }
          ContactsContract.CommonDataKinds.Event.CONTENT_ITEM_TYPE -> {
            // Only the birthday Event row; an anniversary or other event is not a birthday.
            // B-WR-06: when the session gives no TYPE (column missing or null),
            // fall back to the first such row rather than dropping every birthday.
            val eventType = cursor.intAt(data2Column)
            if (eventType == ContactsContract.CommonDataKinds.Event.TYPE_BIRTHDAY) {
              contact.birthday = contact.birthday ?: cursor.stringAt(data1Column)
            } else if (eventType == null) {
              contact.birthdayFallback = contact.birthdayFallback ?: cursor.stringAt(data1Column)
            }
          }
          ContactsContract.CommonDataKinds.Note.CONTENT_ITEM_TYPE ->
            // A provider can expose several Note rows; preserve the first non-blank value.
            contact.note = contact.note ?: cursor.stringAt(data1Column)?.takeIf { it.isNotBlank() }
          ContactsContract.CommonDataKinds.Photo.CONTENT_ITEM_TYPE ->
            // Picker sessions are import-only: full-size first (D-118, D-137).
            readPhotoRow(contact, cursor.blobAt(data15Column), preferFullSize = true)
        }
      }
    }

    return contacts.values.map { contact -> contact.toBridgeMap() }
  }

  /**
   * Legacy (API <= 36) full-provider reader. This is intentionally the tracer
   * implementation: plan 03 replaces its full-book browse read with a
   * summary-plus-selected-key read before the phase completes.
   */
  private fun readAllContacts(): List<Map<String, Any?>> {
    val projection = arrayOf(
      ContactsContract.Data.LOOKUP_KEY,
      ContactsContract.Contacts.DISPLAY_NAME_PRIMARY,
      ContactsContract.Data.MIMETYPE,
      ContactsContract.Data.DATA1,
      ContactsContract.Data.DATA2,
      ContactsContract.Data.DATA3,
      ContactsContract.Data.DATA15,
    )
    val contacts = linkedMapOf<String, MutablePickedContact>()
    val mimeTypes = arrayOf(
      ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE,
      ContactsContract.CommonDataKinds.Email.CONTENT_ITEM_TYPE,
      ContactsContract.CommonDataKinds.Event.CONTENT_ITEM_TYPE,
      ContactsContract.CommonDataKinds.Note.CONTENT_ITEM_TYPE,
      ContactsContract.CommonDataKinds.Photo.CONTENT_ITEM_TYPE,
    )

    context.contentResolver.query(
      ContactsContract.Data.CONTENT_URI,
      projection,
      "${ContactsContract.Data.MIMETYPE} IN (?, ?, ?, ?, ?)",
      mimeTypes,
      "${ContactsContract.Contacts.DISPLAY_NAME_PRIMARY} ASC",
    )?.use { cursor ->
      val lookupKeyColumn = cursor.getColumnIndex(ContactsContract.Data.LOOKUP_KEY)
      val displayNameColumn = cursor.getColumnIndex(ContactsContract.Contacts.DISPLAY_NAME_PRIMARY)
      val mimeTypeColumn = cursor.getColumnIndex(ContactsContract.Data.MIMETYPE)
      val data1Column = cursor.getColumnIndex(ContactsContract.Data.DATA1)
      val data2Column = cursor.getColumnIndex(ContactsContract.Data.DATA2)
      val data3Column = cursor.getColumnIndex(ContactsContract.Data.DATA3)
      val data15Column = cursor.getColumnIndex(ContactsContract.Data.DATA15)

      while (cursor.moveToNext()) {
        val lookupKey = cursor.stringAt(lookupKeyColumn) ?: continue
        val contact = contacts.getOrPut(lookupKey) { MutablePickedContact(lookupKey) }
        contact.displayName = contact.displayName ?: cursor.stringAt(displayNameColumn)

        when (cursor.stringAt(mimeTypeColumn)) {
          ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE ->
            cursor.stringAt(data1Column)?.takeIf { it.isNotBlank() }?.let { value ->
              // D-102: raw TYPE (DATA2) and LABEL (DATA3); null when absent.
              contact.methods += mapOf(
                "type" to "phone",
                "value" to value,
                "typeCode" to cursor.intAt(data2Column),
                "customLabel" to cursor.stringAt(data3Column)?.takeIf { it.isNotBlank() },
              )
            }
          ContactsContract.CommonDataKinds.Email.CONTENT_ITEM_TYPE ->
            cursor.stringAt(data1Column)?.takeIf { it.isNotBlank() }?.let { value ->
              // D-102: raw TYPE (DATA2) and LABEL (DATA3); null when absent.
              contact.methods += mapOf(
                "type" to "email",
                "value" to value,
                "typeCode" to cursor.intAt(data2Column),
                "customLabel" to cursor.stringAt(data3Column)?.takeIf { it.isNotBlank() },
              )
            }
          ContactsContract.CommonDataKinds.Event.CONTENT_ITEM_TYPE ->
            if (cursor.intAt(data2Column) == ContactsContract.CommonDataKinds.Event.TYPE_BIRTHDAY) {
              contact.birthday = contact.birthday ?: cursor.stringAt(data1Column)
            }
          ContactsContract.CommonDataKinds.Note.CONTENT_ITEM_TYPE ->
            // A provider can expose several Note rows; preserve the first non-blank value.
            contact.note = contact.note ?: cursor.stringAt(data1Column)?.takeIf { it.isNotBlank() }
          ContactsContract.CommonDataKinds.Photo.CONTENT_ITEM_TYPE ->
            // No production caller; keeps today's thumbnail-first bytes (D-137).
            readPhotoRow(contact, cursor.blobAt(data15Column), preferFullSize = false)
        }
      }
    }

    return contacts.values.map { contact -> contact.toBridgeMap() }
  }

  /**
   * Lightweight browse-tier read. Contacts is deliberately the first-query
   * spine so structured-name-only contacts remain selectable; Data supplies
   * every phone/email string, merged by lookup key. No full photo is staged.
   */
  private fun listContactsSummary(): List<Map<String, Any?>> {
    val summaries = linkedMapOf<String, MutableContactSummary>()
    context.contentResolver.query(
      ContactsContract.Contacts.CONTENT_URI,
      arrayOf(
        ContactsContract.Contacts.LOOKUP_KEY,
        ContactsContract.Contacts.DISPLAY_NAME_PRIMARY,
        ContactsContract.Contacts.PHOTO_THUMBNAIL_URI,
      ),
      null,
      null,
      "${ContactsContract.Contacts.DISPLAY_NAME_PRIMARY} ASC",
    )?.use { cursor ->
      val lookupKeyColumn = cursor.getColumnIndex(ContactsContract.Contacts.LOOKUP_KEY)
      val displayNameColumn = cursor.getColumnIndex(ContactsContract.Contacts.DISPLAY_NAME_PRIMARY)
      val thumbnailColumn = cursor.getColumnIndex(ContactsContract.Contacts.PHOTO_THUMBNAIL_URI)
      while (cursor.moveToNext()) {
        val lookupKey = cursor.stringAt(lookupKeyColumn) ?: continue
        summaries[lookupKey] = MutableContactSummary(
          lookupKey = lookupKey,
          displayName = cursor.stringAt(displayNameColumn),
          photoThumbUri = cursor.stringAt(thumbnailColumn),
        )
      }
    }

    val methodMimeTypes = arrayOf(
      ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE,
      ContactsContract.CommonDataKinds.Email.CONTENT_ITEM_TYPE,
    )
    context.contentResolver.query(
      ContactsContract.Data.CONTENT_URI,
      arrayOf(
        ContactsContract.Data.LOOKUP_KEY,
        ContactsContract.Data.MIMETYPE,
        ContactsContract.Data.DATA1,
      ),
      "${ContactsContract.Data.MIMETYPE} IN (?, ?)",
      methodMimeTypes,
      null,
    )?.use { cursor ->
      val lookupKeyColumn = cursor.getColumnIndex(ContactsContract.Data.LOOKUP_KEY)
      val data1Column = cursor.getColumnIndex(ContactsContract.Data.DATA1)
      while (cursor.moveToNext()) {
        val lookupKey = cursor.stringAt(lookupKeyColumn) ?: continue
        val summary = summaries[lookupKey] ?: continue
        cursor.stringAt(data1Column)?.takeIf { it.isNotBlank() }?.let { value ->
          summary.methods += value
        }
      }
    }

    return summaries.values.map { summary ->
      mapOf(
        "lookupKey" to summary.lookupKey,
        "displayName" to summary.displayName,
        "methods" to summary.methods,
        "photoThumbUri" to summary.photoThumbUri,
      )
    }
  }

  /**
   * Full selected-tier read for exactly one JS-formed bounded chunk. The first
   * Contacts query keeps selected name-only contacts in the result; the Data
   * query adds methods, birthday, and only then a staged full photo.
   */
  private fun readContactsByLookupKeys(
    lookupKeys: List<String>,
    preferFullSize: Boolean,
  ): List<Map<String, Any?>> {
    if (lookupKeys.isEmpty()) return emptyList()

    val contacts = linkedMapOf<String, MutablePickedContact>()
    val placeholders = lookupKeys.joinToString(",") { "?" }
    context.contentResolver.query(
      ContactsContract.Contacts.CONTENT_URI,
      arrayOf(
        ContactsContract.Contacts.LOOKUP_KEY,
        ContactsContract.Contacts.DISPLAY_NAME_PRIMARY,
      ),
      "${ContactsContract.Contacts.LOOKUP_KEY} IN ($placeholders)",
      lookupKeys.toTypedArray(),
      null,
    )?.use { cursor ->
      val lookupKeyColumn = cursor.getColumnIndex(ContactsContract.Contacts.LOOKUP_KEY)
      val displayNameColumn = cursor.getColumnIndex(ContactsContract.Contacts.DISPLAY_NAME_PRIMARY)
      while (cursor.moveToNext()) {
        val lookupKey = cursor.stringAt(lookupKeyColumn) ?: continue
        contacts[lookupKey] = MutablePickedContact(
          lookupKey = lookupKey,
          displayName = cursor.stringAt(displayNameColumn),
        )
      }
    }

    val mimeTypes = arrayOf(
      ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE,
      ContactsContract.CommonDataKinds.Email.CONTENT_ITEM_TYPE,
      ContactsContract.CommonDataKinds.Event.CONTENT_ITEM_TYPE,
      ContactsContract.CommonDataKinds.Note.CONTENT_ITEM_TYPE,
      ContactsContract.CommonDataKinds.Photo.CONTENT_ITEM_TYPE,
    )
    val projection = arrayOf(
      ContactsContract.Data.LOOKUP_KEY,
      ContactsContract.Data.MIMETYPE,
      ContactsContract.Data.DATA1,
      ContactsContract.Data.DATA2,
      ContactsContract.Data.DATA3,
      ContactsContract.Data.DATA15,
    )
    context.contentResolver.query(
      ContactsContract.Data.CONTENT_URI,
      projection,
      "${ContactsContract.Data.LOOKUP_KEY} IN ($placeholders) AND " +
        "${ContactsContract.Data.MIMETYPE} IN (?, ?, ?, ?, ?)",
      lookupKeys.toTypedArray() + mimeTypes,
      null,
    )?.use { cursor ->
      val lookupKeyColumn = cursor.getColumnIndex(ContactsContract.Data.LOOKUP_KEY)
      val mimeTypeColumn = cursor.getColumnIndex(ContactsContract.Data.MIMETYPE)
      val data1Column = cursor.getColumnIndex(ContactsContract.Data.DATA1)
      val data2Column = cursor.getColumnIndex(ContactsContract.Data.DATA2)
      val data3Column = cursor.getColumnIndex(ContactsContract.Data.DATA3)
      val data15Column = cursor.getColumnIndex(ContactsContract.Data.DATA15)
      while (cursor.moveToNext()) {
        val lookupKey = cursor.stringAt(lookupKeyColumn) ?: continue
        val contact = contacts[lookupKey] ?: continue
        when (cursor.stringAt(mimeTypeColumn)) {
          ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE ->
            cursor.stringAt(data1Column)?.takeIf { it.isNotBlank() }?.let { value ->
              // D-102: raw TYPE (DATA2) and LABEL (DATA3); null when absent.
              contact.methods += mapOf(
                "type" to "phone",
                "value" to value,
                "typeCode" to cursor.intAt(data2Column),
                "customLabel" to cursor.stringAt(data3Column)?.takeIf { it.isNotBlank() },
              )
            }
          ContactsContract.CommonDataKinds.Email.CONTENT_ITEM_TYPE ->
            cursor.stringAt(data1Column)?.takeIf { it.isNotBlank() }?.let { value ->
              // D-102: raw TYPE (DATA2) and LABEL (DATA3); null when absent.
              contact.methods += mapOf(
                "type" to "email",
                "value" to value,
                "typeCode" to cursor.intAt(data2Column),
                "customLabel" to cursor.stringAt(data3Column)?.takeIf { it.isNotBlank() },
              )
            }
          ContactsContract.CommonDataKinds.Event.CONTENT_ITEM_TYPE ->
            if (cursor.intAt(data2Column) == ContactsContract.CommonDataKinds.Event.TYPE_BIRTHDAY) {
              contact.birthday = contact.birthday ?: cursor.stringAt(data1Column)
            }
          ContactsContract.CommonDataKinds.Note.CONTENT_ITEM_TYPE ->
            // A provider can expose several Note rows; preserve the first non-blank value.
            contact.note = contact.note ?: cursor.stringAt(data1Column)?.takeIf { it.isNotBlank() }
          ContactsContract.CommonDataKinds.Photo.CONTENT_ITEM_TYPE ->
            readPhotoRow(contact, cursor.blobAt(data15Column), preferFullSize)
        }
      }
    }

    return contacts.values.map { contact -> contact.toBridgeMap() }
  }

  /**
   * One Photo row → the contact's photo copies and fingerprint, for all three
   * readers. The first Photo row that yields a copy wins.
   *
   * preferFullSize = true (import, D-118/D-135/D-137): the full-size lookup-URI
   * read first, the DATA15 thumbnail as fallback; when the full-size copy is
   * used, the thumbnail is also copied separately for "Import with smaller
   * photos" (D-133). Without READ_CONTACTS (API-37 picker) the lookup read
   * fails inside copyContactPhotoToCache and the thumbnail is used.
   *
   * preferFullSize = false (Check linked contacts, D-137): today's
   * thumbnail-first bytes, full-size only when there is no thumbnail.
   *
   * Never resized here: every master still goes through encodeMaster, which
   * never upscales (ADR-181).
   *
   * The fingerprint (D-132) hashes the thumbnail bytes when present, else the
   * full-size copy, on every path, so it does not change when import switches
   * from thumbnail to full-size bytes.
   */
  private fun readPhotoRow(
    contact: MutablePickedContact,
    data15: ByteArray?,
    preferFullSize: Boolean,
  ) {
    if (contact.photoTempUri != null) return
    val thumbBytes = data15?.takeIf { it.isNotEmpty() }
    var fullCopy: String? = null
    if (preferFullSize) {
      fullCopy = copyContactPhotoToCache(contact.lookupKey)
      contact.photoTempUri = fullCopy ?: thumbBytes?.let(::copyPhotoToCache)
      contact.thumbnailTempUri =
        if (fullCopy != null) thumbBytes?.let(::copyPhotoToCache) else null
    } else {
      val thumbCopy = thumbBytes?.let(::copyPhotoToCache)
      if (thumbCopy == null) fullCopy = copyContactPhotoToCache(contact.lookupKey)
      contact.photoTempUri = thumbCopy ?: fullCopy
      contact.thumbnailTempUri = null
    }
    contact.photoFingerprint = when {
      thumbBytes != null -> photoFingerprint(thumbBytes)
      fullCopy != null -> fingerprintCacheCopy(fullCopy)
      else -> null
    }
  }

  private fun fingerprintCacheCopy(fileUri: String): String? = try {
    Uri.parse(fileUri).path?.let { path -> File(path).inputStream().use { stream -> photoFingerprint(stream) } }
  } catch (_: Exception) {
    null
  }

  private fun copyContactPhotoToCache(lookupKey: String): String? = try {
    val contactUri = Uri.withAppendedPath(ContactsContract.Contacts.CONTENT_LOOKUP_URI, lookupKey)
    ContactsContract.Contacts.openContactPhotoInputStream(context.contentResolver, contactUri, true)
      ?.use(::copyPhotoStreamToCache)
  } catch (_: Exception) {
    null
  }

  private fun copyPhotoToCache(bytes: ByteArray): String? {
    if (bytes.isEmpty()) return null
    val destination = File.createTempFile("contact-picker-", ".photo", context.cacheDir)
    return try {
      FileOutputStream(destination).use { output -> output.write(bytes) }
      Uri.fromFile(destination).toString()
    } catch (_: Exception) {
      destination.delete()
      null
    }
  }

  private fun copyPhotoStreamToCache(input: InputStream): String? {
    val destination = File.createTempFile("contact-picker-", ".photo", context.cacheDir)
    return try {
      FileOutputStream(destination).use { output -> input.copyTo(output) }
      Uri.fromFile(destination).toString()
    } catch (_: Exception) {
      destination.delete()
      null
    }
  }

  private fun android.database.Cursor.stringAt(columnIndex: Int): String? =
    if (columnIndex >= 0 && !isNull(columnIndex)) getString(columnIndex) else null

  private fun android.database.Cursor.blobAt(columnIndex: Int): ByteArray? =
    if (columnIndex >= 0 && !isNull(columnIndex)) getBlob(columnIndex) else null

  private fun android.database.Cursor.intAt(columnIndex: Int): Int? =
    if (columnIndex >= 0 && !isNull(columnIndex)) getInt(columnIndex) else null
}
