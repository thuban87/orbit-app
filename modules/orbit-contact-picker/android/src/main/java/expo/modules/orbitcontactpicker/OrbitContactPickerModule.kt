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
private const val EXTRA_USE_SYSTEM_CONTACTS_PICKER =
  "android.provider.extra.USE_SYSTEM_CONTACTS_PICKER"
private const val EXTRA_PICK_CONTACTS_REQUESTED_DATA_FIELDS =
  "android.provider.extra.PICK_CONTACTS_REQUESTED_DATA_FIELDS"
private const val PICK_CONTACTS_CODE = 9472

internal class ContactPickInProgressException :
  CodedException("A system contact picker request is already in progress.")

internal class ContactPickLaunchException :
  CodedException("Unable to start the system contact picker.")

private data class MutablePickedContact(
  val lookupKey: String,
  var displayName: String? = null,
  val methods: MutableList<Map<String, String>> = mutableListOf(),
  var birthday: String? = null,
  var photoTempUri: String? = null,
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
            ContactsContract.CommonDataKinds.Photo.CONTENT_ITEM_TYPE,
          ),
        )
        if (multiple) {
          putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
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
      ContactsContract.Data.DATA15,
    )
    val contacts = linkedMapOf<String, MutablePickedContact>()

    // Picker session URIs reject selection and selectionArgs. Read only the
    // temporary, OS-granted table and group its data rows by lookup key.
    context.contentResolver.query(sessionUri, projection, null, null, null)?.use { cursor ->
      val lookupKeyColumn = cursor.getColumnIndex(ContactsContract.Data.LOOKUP_KEY)
      val displayNameColumn = cursor.getColumnIndex(ContactsContract.Contacts.DISPLAY_NAME_PRIMARY)
      val mimeTypeColumn = cursor.getColumnIndex(ContactsContract.Data.MIMETYPE)
      val data1Column = cursor.getColumnIndex(ContactsContract.Data.DATA1)
      val data15Column = cursor.getColumnIndex(ContactsContract.Data.DATA15)

      while (cursor.moveToNext()) {
        val lookupKey = cursor.stringAt(lookupKeyColumn) ?: continue
        val contact = contacts.getOrPut(lookupKey) { MutablePickedContact(lookupKey) }
        contact.displayName = contact.displayName ?: cursor.stringAt(displayNameColumn)

        when (cursor.stringAt(mimeTypeColumn)) {
          ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE ->
            cursor.stringAt(data1Column)?.takeIf { it.isNotBlank() }?.let { value ->
              contact.methods += mapOf("type" to "phone", "value" to value)
            }
          ContactsContract.CommonDataKinds.Email.CONTENT_ITEM_TYPE ->
            cursor.stringAt(data1Column)?.takeIf { it.isNotBlank() }?.let { value ->
              contact.methods += mapOf("type" to "email", "value" to value)
            }
          ContactsContract.CommonDataKinds.Event.CONTENT_ITEM_TYPE ->
            contact.birthday = contact.birthday ?: cursor.stringAt(data1Column)
          ContactsContract.CommonDataKinds.Photo.CONTENT_ITEM_TYPE -> {
            if (contact.photoTempUri == null) {
              contact.photoTempUri = cursor.blobAt(data15Column)?.let(::copyPhotoToCache)
                ?: copyContactPhotoToCache(lookupKey)
            }
          }
        }
      }
    }

    return contacts.values.map { contact ->
      mapOf(
        "lookupKey" to contact.lookupKey,
        "displayName" to contact.displayName,
        "methods" to contact.methods,
        "birthday" to contact.birthday,
        "photoTempUri" to contact.photoTempUri,
      )
    }
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
}
