package expo.modules.orbitbackupdocumentpicker

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Debug
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
    mapOf("uri" to file?.let { Uri.fromFile(it).toString() }, "failed" to failed)

  private fun normalizedMimeType(type: String?): String? =
    type?.substringBefore(';')?.trim()?.lowercase(Locale.ROOT)

  @Suppress("DEPRECATION")
  private fun Intent.extraStreamUri(): Uri? = when {
    android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU ->
      getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
    else -> getParcelableExtra(Intent.EXTRA_STREAM) as? Uri
  }
}
