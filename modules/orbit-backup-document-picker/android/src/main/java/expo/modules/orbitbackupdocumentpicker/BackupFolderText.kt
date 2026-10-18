package expo.modules.orbitbackupdocumentpicker

import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream

/**
 * 38.12 D-158: pure stream helpers behind the backup folder's read and write.
 * The module opens the streams through ContentResolver, which works for every
 * document provider (Google Drive included); these helpers only move text, so
 * they are JVM-testable without Android.
 */
internal object BackupFolderText {
  /** UTF-8 text of [input], refused past [ceilingBytes] (D-19's ingress ceiling). */
  fun readBounded(input: InputStream, ceilingBytes: Long = MAX_BACKUP_INGRESS_BYTES): String =
    input.use { source ->
      val output = ByteArrayOutputStream()
      val buffer = ByteArray(8192)
      var count = 0L
      while (true) {
        val n = source.read(buffer)
        if (n < 0) break
        count += n
        if (count > ceilingBytes) throw IOException("Backup file too large")
        output.write(buffer, 0, n)
      }
      output.toString(Charsets.UTF_8.name())
    }

  /** Writes [contents] as UTF-8 and closes [output]; a null stream is a failure. */
  fun write(output: OutputStream?, contents: String) {
    val target = output ?: throw IOException("The backup folder refused the write")
    target.use { it.write(contents.toByteArray(Charsets.UTF_8)) }
  }
}
