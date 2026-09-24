package expo.modules.orbitsecurefetch

import java.io.IOException
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody
import okhttp3.ResponseBody.Companion.toResponseBody
import okio.Buffer
import okio.Source
import okio.Timeout
import okio.buffer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class SecureResponseReaderTest {
  private fun body(source: Source): ResponseBody = object : ResponseBody() {
    override fun contentType() = "text/plain; charset=utf-8".toMediaType()
    override fun contentLength() = -1L
    override fun source() = source.buffer()
  }

  private fun source(readAction: (Buffer, Long) -> Long): Source = object : Source {
    override fun read(sink: Buffer, byteCount: Long) = readAction(sink, byteCount)
    override fun timeout() = Timeout.NONE
    override fun close() {}
  }

  @Test fun exactCapSucceedsAndOverCapRejects() {
    assertEquals("abcd", readBounded("abcd".toResponseBody(), 4, { false }))
    try {
      readBounded("abcde".toResponseBody(), 4, { false })
      fail("must reject")
    } catch (_: ResponseTooLargeException) {}
    assertEquals("abcd", readBounded("abcde".toResponseBody(), 4, { false }, truncateOnLimit = true))
  }

  @Test fun truncatedSourceRejectsAndDelayedBodySucceeds() {
    val broken = source { _, _ -> throw IOException("truncated") }
    try { readBounded(body(broken), 10, { false }); fail("must reject") }
    catch (_: IOException) {}
    var reads = 0
    val delayed = source { sink, _ ->
      if (reads++ == 0) { Thread.sleep(25); sink.writeUtf8("ok"); 2L } else -1L
    }
    assertEquals("ok", readBounded(body(delayed), 10, { false }))
  }

  @Test fun cancelInsideReadReturningDataSettlesCancelledOnce() {
    val canceled = AtomicBoolean(false)
    val source = source { sink, _ -> canceled.set(true); sink.writeUtf8("x"); 1L }
    var settlements = 0
    val settle = SettleOnce<String>({ settlements++ }, { code -> assertEquals("ERR_CANCELLED", code); settlements++ })
    try { readBounded(body(source), 10, { canceled.get() }); fail("must cancel") }
    catch (_: ResponseCancelledException) { settle.reject("ERR_CANCELLED") }
    settle.resolve("late")
    assertEquals(1, settlements)
  }

  @Test fun cancelInsideReadThrowingIOExceptionSettlesCancelledOnce() {
    val canceled = AtomicBoolean(false)
    val source = source { _, _ -> canceled.set(true); throw IOException("socket closed") }
    var settlements = 0
    val settle = SettleOnce<String>({ settlements++ }, { code -> assertEquals("ERR_CANCELLED", code); settlements++ })
    try { readBounded(body(source), 10, { canceled.get() }); fail("must cancel") }
    catch (_: ResponseCancelledException) { settle.reject("ERR_CANCELLED") }
    settle.reject("ERR_TRANSPORT")
    assertEquals(1, settlements)
  }

  @Test fun crossThreadCancelWhileReadBlocksSettlesCancelledOnce() {
    val entered = CountDownLatch(1)
    val release = CountDownLatch(1)
    val canceled = AtomicBoolean(false)
    val source = source { sink, _ -> entered.countDown(); release.await(); sink.writeUtf8("x"); 1L }
    var settlements = 0
    val settle = SettleOnce<String>({ settlements++ }, { code -> assertEquals("ERR_CANCELLED", code); settlements++ })
    val worker = Thread {
      try { readBounded(body(source), 10, { canceled.get() }); settle.resolve("late") }
      catch (_: ResponseCancelledException) { settle.reject("ERR_CANCELLED") }
    }
    worker.start()
    assertTrue(entered.await(2, TimeUnit.SECONDS))
    canceled.set(true)
    release.countDown()
    worker.join(2_000)
    settle.reject("ERR_TRANSPORT")
    assertEquals(1, settlements)
  }

  @Test fun tombstonesExpireAndStayBounded() {
    var clock = 0L
    val tombstones = CancelTombstones { clock }
    tombstones.add("old")
    clock = CANCEL_TOMBSTONE_TTL_MS + 1
    tombstones.add("new")
    assertTrue(!tombstones.contains("old"))
    repeat(MAX_CANCEL_TOMBSTONES + 10) { tombstones.add("id-$it") }
    assertEquals(MAX_CANCEL_TOMBSTONES, tombstones.size())
  }
}
