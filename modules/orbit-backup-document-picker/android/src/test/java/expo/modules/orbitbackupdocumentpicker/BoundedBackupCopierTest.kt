package expo.modules.orbitbackupdocumentpicker

import java.io.ByteArrayInputStream
import java.io.File
import java.io.IOException
import java.io.InputStream
import java.nio.file.Files
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread
import org.junit.Assert.*
import org.junit.Test

class BoundedBackupCopierTest {
  private fun destination(): File = File(Files.createTempDirectory("backup-copy-test").toFile(), "partial.json")

  @Test fun exactLimitSucceeds() {
    val file = destination()
    BoundedBackupCopier(ceilingBytes = 4).copy(ByteArrayInputStream("1234".toByteArray()), file)
    assertEquals("1234", file.readText())
  }

  @Test fun overLimitDeletesPartial() {
    val file = destination()
    try {
      BoundedBackupCopier(ceilingBytes = 4).copy(ByteArrayInputStream("12345".toByteArray()), file)
      fail("expected ceiling")
    } catch (_: IOException) { assertFalse(file.exists()) }
  }

  @Test fun endlessStreamHitsInjectedCeiling() {
    val file = destination()
    val endless = object : InputStream() { override fun read(): Int = 65 }
    try {
      BoundedBackupCopier(ceilingBytes = 8192).copy(endless, file)
      fail("expected ceiling")
    } catch (_: IOException) { assertFalse(file.exists()) }
  }

  @Test fun stalledStreamIsClosedAndPartialDeleted() {
    val file = destination()
    val closed = CountDownLatch(1)
    val input = object : InputStream() {
      override fun read(): Int {
        closed.await(2, TimeUnit.SECONDS)
        throw IOException("closed")
      }
      override fun close() { closed.countDown() }
    }
    val worker = thread { try { BoundedBackupCopier(stallMs = 20).copy(input, file) } catch (_: IOException) { } }
    worker.join(2000)
    assertFalse(worker.isAlive)
    assertFalse(file.exists())
  }

  @Test fun cancelledCopyDeletesPartial() {
    val file = destination()
    try {
      BoundedBackupCopier().copy(ByteArrayInputStream("1234".toByteArray()), file) { false }
      fail("expected cancellation")
    } catch (_: IOException) { assertFalse(file.exists()) }
  }
}
