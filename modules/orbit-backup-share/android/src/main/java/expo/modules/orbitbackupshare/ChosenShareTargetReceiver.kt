package expo.modules.orbitbackupshare

import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build

/**
 * The system chooser calls this with the component the user picked. A share
 * target such as Google Drive reads the file after its receiving activity has
 * finished (background upload), when the chooser's temporary grant no longer
 * covers it. Granting that one package directly keeps the upload readable while
 * no other app gains access (ADR-155). The grant is revoked when the staged
 * export is retired.
 */
class ChosenShareTargetReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val chosen: ComponentName? =
      if (Build.VERSION.SDK_INT >= 33) {
        intent.getParcelableExtra(Intent.EXTRA_CHOSEN_COMPONENT, ComponentName::class.java)
      } else {
        @Suppress("DEPRECATION")
        intent.getParcelableExtra(Intent.EXTRA_CHOSEN_COMPONENT)
      }
    val uri = intent.getStringExtra(EXTRA_SHARED_URI)?.let(Uri::parse) ?: return
    val packageName = chosen?.packageName ?: return
    if (packageName == context.packageName) return
    context.grantUriPermission(packageName, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
  }

  companion object {
    const val EXTRA_SHARED_URI = "expo.modules.orbitbackupshare.SHARED_URI"
  }
}
