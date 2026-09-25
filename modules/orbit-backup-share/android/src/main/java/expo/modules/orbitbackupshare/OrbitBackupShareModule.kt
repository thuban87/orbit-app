package expo.modules.orbitbackupshare

import android.app.PendingIntent
import android.content.ClipData
import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

private const val EXPORT_DIRECTORY = "backup-exports"
private const val REQUEST_CODE = 8611
private val STAGED_NAME = Regex("^orbit-backup-\\d+\\.json$")

private class NotAStagedExportException :
  CodedException("ERR_NOT_STAGED_EXPORT", "Only staged backup exports can be shared.", null)

/**
 * Outbound backup share (ADR-155). Shares only a staged export under
 * cache/backup-exports through the app's SharingFileProvider, and grants read
 * access to exactly the app the user picks in the chooser (via
 * EXTRA_CHOSEN_COMPONENT) instead of relying on the chooser's temporary grant.
 */
class OrbitBackupShareModule : Module() {
  private var pendingPromise: Promise? = null

  private fun contentUriFor(fileUri: String): Uri {
    val context = appContext.reactContext ?: throw NotAStagedExportException()
    val path = Uri.parse(fileUri).path ?: throw NotAStagedExportException()
    val file = File(path).canonicalFile
    val exportDir = File(context.cacheDir, EXPORT_DIRECTORY).canonicalFile
    if (file.parentFile != exportDir || !STAGED_NAME.matches(file.name) || !file.isFile) {
      throw NotAStagedExportException()
    }
    return FileProvider.getUriForFile(
      context,
      "${context.packageName}.SharingFileProvider",
      file,
    )
  }

  override fun definition() = ModuleDefinition {
    Name("OrbitBackupShare")

    AsyncFunction("share") { fileUri: String, mimeType: String, title: String, promise: Promise ->
      val activity = appContext.throwingActivity
      val contentUri = contentUriFor(fileUri)
      val send = Intent(Intent.ACTION_SEND).apply {
        type = mimeType
        putExtra(Intent.EXTRA_STREAM, contentUri)
        clipData = ClipData.newRawUri(null, contentUri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      val callback = Intent(activity, ChosenShareTargetReceiver::class.java)
        .putExtra(ChosenShareTargetReceiver.EXTRA_SHARED_URI, contentUri.toString())
      // MUTABLE is required so the chooser can fill in EXTRA_CHOSEN_COMPONENT; the
      // intent is explicit to this app's non-exported receiver.
      val chosen = PendingIntent.getBroadcast(
        activity,
        REQUEST_CODE,
        callback,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
      )
      pendingPromise?.resolve(null)
      pendingPromise = promise
      activity.startActivityForResult(
        Intent.createChooser(send, title, chosen.intentSender),
        REQUEST_CODE,
      )
    }

    Function("revoke") { fileUri: String ->
      val context = appContext.reactContext ?: return@Function
      val uri = try {
        contentUriFor(fileUri)
      } catch (_: Exception) {
        return@Function
      }
      context.revokeUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }

    OnActivityResult { _, (requestCode) ->
      if (requestCode == REQUEST_CODE) {
        pendingPromise?.resolve(null)
        pendingPromise = null
      }
    }
  }
}
