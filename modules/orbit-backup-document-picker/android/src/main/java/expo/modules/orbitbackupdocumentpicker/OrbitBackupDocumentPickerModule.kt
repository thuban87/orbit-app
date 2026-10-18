package expo.modules.orbitbackupdocumentpicker

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Debug
import android.provider.DocumentsContract
import android.util.Log
import java.io.File
import java.util.Locale
import java.util.UUID
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private val BACKUP_MIME_TYPES = setOf("application/json", "text/json")
private const val PICK_BACKUP_CODE = 7391

internal class PickInProgressException : CodedException("A backup document is already being picked.")

/** Scoped-storage grants are acquired only by the background registry. */
class OrbitBackupDocumentPickerModule : Module() {
  private var capturedIntent: Intent? = null
  // This protects only the picker UI. Release at activity result, before copy.
  private var pendingPickPromise: Promise? = null
  private var ingress: BackupIngressRequests? = null

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun requests(): BackupIngressRequests = ingress ?: BackupIngressRequests(
    opener = { source -> context.contentResolver.openInputStream(Uri.parse(source)) },
    copier = BoundedBackupCopier(ceilingBytes = MAX_BACKUP_INGRESS_BYTES),
    onMeasured = { acquisitionMs, copyMs, bytes ->
      if (BuildConfig.DEBUG) Log.i("OrbitBackupIngressMeasure", "acquisitionMs=$acquisitionMs copyMs=$copyMs bytes=$bytes")
    },
  ).also { ingress = it }

  override fun definition() = ModuleDefinition {
    Name("OrbitBackupDocumentPicker")

    Function("sampleProcessPssKb") {
      if (!BuildConfig.DEBUG) null
      else Debug.MemoryInfo().also(Debug::getMemoryInfo).totalPss
    }

    OnCreate { appContext.currentActivity?.intent?.let(::captureBackupShare) }
    OnNewIntent { intent -> captureBackupShare(intent) }
    OnDestroy {
      pendingPickPromise?.resolve(mapOf("uri" to null, "failed" to true))
      pendingPickPromise = null
      ingress?.destroyAll()
      ingress = null
    }

    // 38.12 D-143: the chosen backup folder's own display name, for any
    // document provider (Google Drive's tree ids are opaque). Null when the
    // provider cannot answer; the TS side then derives a neutral name.
    AsyncFunction("folderDisplayName") { treeUri: String ->
      readFolderDisplayName(treeUri)
    }

    // 38.12 review A-WR-02 / D-WR-03: the folder's children with their display
    // names, so backup files are recognised by name and never by the last URI
    // segment (an opaque id on Drive). Child URIs are built exactly as
    // DocumentFile.listFiles (expo-file-system's readDirectoryAsync) builds
    // them, so read/delete keep working on the same URIs. Null on failure.
    AsyncFunction("listFolderEntries") { treeUri: String ->
      listFolderEntries(treeUri)
    }

    Function("hasSharedBackup") {
      // Cold-start order: currentActivity may not exist at OnCreate time.
      appContext.currentActivity?.intent?.let(::captureBackupShare)
      ingress?.hasShare() == true
    }

    AsyncFunction("consumeSharedBackup") { promise: Promise ->
      requests().consumeShare().thenAccept { result -> promise.resolve(result.toMap()) }
    }

    AsyncFunction("pickBackupDocument") { promise: Promise ->
      if (pendingPickPromise != null) throw PickInProgressException()
      val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
        addCategory(Intent.CATEGORY_OPENABLE)
        type = "*/*"
        putExtra(Intent.EXTRA_MIME_TYPES, BACKUP_MIME_TYPES.toTypedArray())
      }
      pendingPickPromise = promise
      try { appContext.throwingActivity.startActivityForResult(intent, PICK_BACKUP_CODE) }
      catch (_: Exception) {
        pendingPickPromise = null
        promise.resolve(mapOf("uri" to null, "failed" to true))
      }
    }

    OnActivityResult { _, (requestCode, resultCode, intent) ->
      if (requestCode != PICK_BACKUP_CODE) return@OnActivityResult
      val promise = pendingPickPromise ?: return@OnActivityResult
      pendingPickPromise = null
      val source = if (resultCode == Activity.RESULT_OK) intent?.data else null
      if (source == null) {
        promise.resolve(mapOf("uri" to null))
        return@OnActivityResult
      }
      try {
        val destination = File(context.cacheDir, "restore-share-${UUID.randomUUID()}.json")
        requests().submitPick(source.toString(), destination).thenAccept { result ->
          promise.resolve(result.toMap())
        }
      } catch (_: Exception) {
        promise.resolve(mapOf("uri" to null, "failed" to true))
      }
    }
  }

  /** The folder document for a tree URI, as DocumentFile.fromTreeUri builds it. */
  private fun folderDocumentUri(treeUri: Uri): Uri {
    var documentId = DocumentsContract.getTreeDocumentId(treeUri)
    if (DocumentsContract.isDocumentUri(context, treeUri)) {
      documentId = DocumentsContract.getDocumentId(treeUri)
    }
    return DocumentsContract.buildDocumentUriUsingTree(treeUri, documentId)
  }

  private fun readFolderDisplayName(treeUri: String): String? =
    try {
      context.contentResolver.query(
        folderDocumentUri(Uri.parse(treeUri)),
        arrayOf(DocumentsContract.Document.COLUMN_DISPLAY_NAME),
        null,
        null,
        null,
      )?.use { cursor ->
        if (cursor.moveToFirst()) cursor.getString(0)?.trim()?.takeIf { it.isNotEmpty() } else null
      }
    } catch (_: Exception) {
      null
    }

  private fun listFolderEntries(treeUri: String): List<Map<String, String?>>? =
    try {
      val folder = folderDocumentUri(Uri.parse(treeUri))
      val children = DocumentsContract.buildChildDocumentsUriUsingTree(
        folder,
        DocumentsContract.getDocumentId(folder),
      )
      context.contentResolver.query(
        children,
        arrayOf(
          DocumentsContract.Document.COLUMN_DOCUMENT_ID,
          DocumentsContract.Document.COLUMN_DISPLAY_NAME,
          DocumentsContract.Document.COLUMN_MIME_TYPE,
        ),
        null,
        null,
        null,
      )?.use { cursor ->
        val entries = mutableListOf<Map<String, String?>>()
        while (cursor.moveToNext()) {
          val documentId = cursor.getString(0) ?: continue
          entries.add(
            mapOf(
              "uri" to DocumentsContract.buildDocumentUriUsingTree(folder, documentId).toString(),
              "name" to cursor.getString(1),
              "mimeType" to cursor.getString(2),
            ),
          )
        }
        entries
      }
    } catch (_: Exception) {
      null
    }

  private fun captureBackupShare(intent: Intent) {
    if (capturedIntent === intent) return
    capturedIntent = intent
    if (intent.action != Intent.ACTION_SEND || normalizedMimeType(intent.type) !in BACKUP_MIME_TYPES) return
    val source = intent.extraStreamUri() ?: return
    try {
      val destination = File(context.cacheDir, "restore-share-${UUID.randomUUID()}.json")
      requests().submitShare(source.toString(), destination)
    } catch (_: Exception) {
      // Do not reveal provider paths or exception detail to the share surface.
    }
  }

  private fun IngressResult.toMap(): Map<String, Any?> =
    mapOf(
      "uri" to file?.let { Uri.fromFile(it).toString() },
      "failed" to failed,
      "notBackup" to notBackup,
    )

  private fun normalizedMimeType(type: String?): String? =
    type?.substringBefore(';')?.trim()?.lowercase(Locale.ROOT)

  @Suppress("DEPRECATION")
  private fun Intent.extraStreamUri(): Uri? = when {
    android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU ->
      getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
    else -> getParcelableExtra(Intent.EXTRA_STREAM) as? Uri
  }
}
