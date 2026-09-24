package expo.modules.orbitbackupdocumentpicker

import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicBoolean

// A no-progress limit, not a limit on the duration of a progressing backup.
internal const val BACKUP_INGRESS_STALL_MS = 30_000L

/** Pure stream copier. Closing a blocked read is best effort; request ownership
 * ensures any late return is discarded even if a provider ignores close(). */
internal class BoundedBackupCopier(
  private val stallMs: Long = BACKUP_INGRESS_STALL_MS,
  private val ceilingBytes: Long? = null,
  private val clock: () -> Long = System::currentTimeMillis,
) {
  fun copy(input: InputStream, destination: File, owns: () -> Boolean = { true }): File {
    val lastProgress = AtomicLong(clock())
    val watchdog = Executors.newSingleThreadScheduledExecutor { runnable ->
      Thread(runnable, "backup-ingress-watchdog").apply { isDaemon = true }
    }
    val stalled = AtomicBoolean(false)
    val watcher = watchdog.scheduleWithFixedDelay({
      if (clock() - lastProgress.get() >= stallMs) {
        stalled.set(true)
        try { input.close() } catch (_: Exception) { }
      }
    }, minOf(stallMs, 100L), minOf(stallMs, 100L), TimeUnit.MILLISECONDS)
    try {
      input.use { source ->
        FileOutputStream(destination).use { output ->
          val buffer = ByteArray(8192)
          var count = 0L
          while (true) {
            if (!owns() || stalled.get()) throw IOException("Backup ingress cancelled or stalled")
            val n = source.read(buffer)
            if (n < 0) break
            if (n == 0) { Thread.sleep(10); continue }
            count += n
            if (ceilingBytes != null && count > ceilingBytes) throw IOException("Backup ingress too large")
            output.write(buffer, 0, n)
            lastProgress.set(clock())
          }
        }
      }
      if (!owns() || stalled.get()) throw IOException("Backup ingress cancelled or stalled")
      return destination
    } catch (error: Exception) {
      destination.delete()
      throw error
    } finally {
      watcher.cancel(true)
      watchdog.shutdownNow()
    }
  }
}
