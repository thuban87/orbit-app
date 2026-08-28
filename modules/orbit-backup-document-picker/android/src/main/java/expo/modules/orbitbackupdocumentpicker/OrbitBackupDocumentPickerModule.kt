package expo.modules.orbitbackupdocumentpicker

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import java.io.File
import java.io.FileOutputStream
import java.util.Locale
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private val BACKUP_MIME_TYPES = setOf("application/json", "text/json")

// Distinct from any expo-document-picker request code so results never cross.
private const val PICK_BACKUP_CODE = 7391

internal class PickInProgressException :
  CodedException("A backup document is already being picked.")

/**
 * Stores an app-private cache URI until JavaScript consumes it. This is never a
 * provider URI: the temporary Android grant is used only while copying bytes.
 */
internal object SharedBackupCoordinator {
  private var pendingUri: String? = null

  @Synchronized
  fun store(uri: String) {
    pendingUri?.let { previous ->
      if (previous.startsWith("file:")) File(Uri.parse(previous).path ?: "").delete()
    }
    pendingUri = uri
  }

  @Synchronized
  fun hasPending(): Boolean = pendingUri != null

  @Synchronized
  fun consume(): String? = pendingUri.also { pendingUri = null }
}

/**
 * Receives a single JSON document selected by the user in a file manager's
 * Android Sharesheet. This is the scoped-storage-safe fallback for the Pixel's
 * non-rendering DocumentsUI task: it neither launches DocumentsUI nor requests
 * broad Downloads/media permissions.
 */
class OrbitBackupDocumentPickerModule : Module() {
  // `hasSharedBackup` may run more than once while React Navigation becomes
  // ready. Keep an already-handled Activity intent from copying the same
  // user-granted document into cache repeatedly.
  private var capturedIntent: Intent? = null

  // Held only while the direct-picker activity is in the foreground. The Pixel's
  // DocumentsUI hangs on ACTION_OPEN_DOCUMENT launched from Orbit's task, so the
  // direct Restore button launches ACTION_GET_CONTENT in-task instead (no
  // FLAG_ACTIVITY_NEW_TASK, so the result is still delivered here).
  private var pendingPickPromise: Promise? = null

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("OrbitBackupDocumentPicker")

    // Cold-share launch: inspect MainActivity's first intent after this module
    // is created. A warm share is handled below by the Expo module lifecycle.
    OnCreate {
      appContext.currentActivity?.intent?.let(::captureBackupShare)
    }

    OnNewIntent { intent ->
      captureBackupShare(intent)
    }

    Function("hasSharedBackup") {
      // `OnCreate` can run before Expo has attached currentActivity on a cold
      // share launch. Re-read the current intent here, when ShareIntentGate is
      // evaluating the pending share, so the same one-document grant is not
      // lost to that lifecycle ordering.
      appContext.currentActivity?.intent?.let(::captureBackupShare)
      SharedBackupCoordinator.hasPending()
    }

    AsyncFunction("consumeSharedBackup") {
      mapOf("uri" to SharedBackupCoordinator.consume())
    }

    // Direct Restore button. Launches ACTION_GET_CONTENT (not the
    // ACTION_OPEN_DOCUMENT that leaves this Pixel's DocumentsUI on a blank
    // PickActivity) and copies the one user-selected document into app-private
    // cache, exactly like the share receiver. Resolves { uri: null } on cancel.
    AsyncFunction("pickBackupDocument") { promise: Promise ->
      if (pendingPickPromise != null) {
        throw PickInProgressException()
      }
      val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
        addCategory(Intent.CATEGORY_OPENABLE)
        type = "*/*"
        putExtra(Intent.EXTRA_MIME_TYPES, BACKUP_MIME_TYPES.toTypedArray())
      }
      pendingPickPromise = promise
      appContext.throwingActivity.startActivityForResult(intent, PICK_BACKUP_CODE)
    }

    OnActivityResult { _, (requestCode, resultCode, intent) ->
      if (requestCode != PICK_BACKUP_CODE) {
        return@OnActivityResult
      }
      val promise = pendingPickPromise ?: return@OnActivityResult
      pendingPickPromise = null

      val source = if (resultCode == Activity.RESULT_OK) intent?.data else null
      if (source == null) {
        promise.resolve(mapOf("uri" to null))
        return@OnActivityResult
      }
      try {
        promise.resolve(mapOf("uri" to copyToCache(source)))
      } catch (error: Exception) {
        // Keep the user-safe generic failure state; never surface provider
        // paths or exception detail into JS.
        promise.resolve(mapOf("uri" to null))
      }
    }
  }

  private fun captureBackupShare(intent: Intent) {
    if (capturedIntent === intent) return
    capturedIntent = intent

    val mimeType = normalizedMimeType(intent.type)
    if (intent.action != Intent.ACTION_SEND || mimeType !in BACKUP_MIME_TYPES) {
      return
    }
    val source = intent.extraStreamUri()
    if (source == null) {
      return
    }
    try {
      SharedBackupCoordinator.store(copyToCache(source))
    } catch (_: Exception) {
      // The normal backup screen has a user-safe generic failure state. Do not
      // leak provider paths or exception details into a shared-intent surface.
    }
  }

  private fun copyToCache(source: Uri): String {
    val destination = File.createTempFile("restore-share-", ".json", context.cacheDir)
    try {
      context.contentResolver.openInputStream(source).use { input ->
        requireNotNull(input) { "Missing shared-document input stream." }
        FileOutputStream(destination).use { output -> input.copyTo(output) }
      }
    } catch (error: Exception) {
      destination.delete()
      throw error
    }
    return Uri.fromFile(destination).toString()
  }

  private fun normalizedMimeType(type: String?): String? =
    type?.substringBefore(';')?.trim()?.lowercase(Locale.ROOT)

  @Suppress("DEPRECATION")
  private fun Intent.extraStreamUri(): Uri? = when {
    android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU ->
      getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
    else -> getParcelableExtra(Intent.EXTRA_STREAM) as? Uri
  }
}
