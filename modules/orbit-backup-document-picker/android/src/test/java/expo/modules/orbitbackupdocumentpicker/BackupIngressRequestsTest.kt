package expo.modules.orbitbackupdocumentpicker

import java.io.ByteArrayInputStream
import java.io.File
import java.io.InputStream
import java.nio.file.Files
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.junit.Assert.*
import org.junit.Test

class BackupIngressRequestsTest {
  private fun file(): File = File(Files.createTempDirectory("backup-requests-test").toFile(), "restore-share.json")
  private fun <T> java.util.concurrent.CompletableFuture<T>.await(): T = get(2, TimeUnit.SECONDS)
  private fun waitForProvider(release: CountDownLatch) {
    while (true) {
      try { release.await(); return } catch (_: InterruptedException) { /* binder may ignore cancellation */ }
    }
  }

  @Test fun newerShareSupersedesOlderAndLateStreamIsClosed() {
    val entered = CountDownLatch(1)
    val release = CountDownLatch(1)
    val late = TrackingStream("old")
    val requests = BackupIngressRequests(opener = { source ->
      if (source == "A") { entered.countDown(); waitForProvider(release); late } else ByteArrayInputStream("new".toByteArray())
    })
    val a = file(); requests.submitShare("A", a)
    assertTrue(entered.await(1, TimeUnit.SECONDS))
    val waitingForLatest = requests.consumeShare()
    val b = file(); requests.submitShare("B", b)
    assertEquals("new", waitingForLatest.await().file?.readText())
    assertFalse(requests.hasShare())
    release.countDown()
    Thread.sleep(50)
    assertTrue(late.closed)
    assertFalse(a.exists())
    requests.destroyAll()
  }

  @Test fun injectedAcquisitionDeadlineClosesLateStream() {
    val entered = CountDownLatch(1)
    val release = CountDownLatch(1)
    val late = TrackingStream("late")
    val requests = BackupIngressRequests(opener = { entered.countDown(); waitForProvider(release); late }, acquisitionMs = 30)
    val target = file(); requests.submitShare("A", target)
    assertTrue(entered.await(1, TimeUnit.SECONDS))
    assertTrue(requests.consumeShare().await().failed)
    release.countDown(); Thread.sleep(50)
    assertTrue(late.closed)
    assertFalse(target.exists())
    requests.destroyAll()
  }

  @Test fun queuedRequestGetsItsOwnSubmissionDeadline() {
    val entered = CountDownLatch(1)
    val release = CountDownLatch(1)
    val requests = BackupIngressRequests(opener = { source ->
      if (source == "A") { entered.countDown(); waitForProvider(release) }
      ByteArrayInputStream(source.toByteArray())
    }, acquisitionMs = 30, workers = 1, cap = 2)
    requests.submitPick("A", file()); assertTrue(entered.await(1, TimeUnit.SECONDS))
    assertTrue(requests.submitShare("B", file()).await().failed)
    release.countDown(); requests.destroyAll()
  }

  @Test fun defaultHasNoAcquisitionDeadline() {
    assertNull(BACKUP_INGRESS_ACQUIRE_MS)
    val entered = CountDownLatch(1)
    val release = CountDownLatch(1)
    val late = TrackingStream("late")
    val requests = BackupIngressRequests(opener = { entered.countDown(); waitForProvider(release); late })
    val result = requests.submitPick("A", file())
    assertTrue(entered.await(1, TimeUnit.SECONDS))
    Thread.sleep(50); assertFalse(result.isDone)
    release.countDown()
    assertEquals("late", result.await().file?.readText())
    requests.destroyAll()
  }

  @Test fun newerPickSettlesOlderAndCopiesDespiteBlockedAcquisition() {
    val entered = CountDownLatch(1)
    val release = CountDownLatch(1)
    val late = TrackingStream("old")
    val requests = BackupIngressRequests(opener = { source ->
      if (source == "A") { entered.countDown(); waitForProvider(release); late }
      else ByteArrayInputStream("new".toByteArray())
    })
    val a = file(); val old = requests.submitPick("A", a)
    assertTrue(entered.await(1, TimeUnit.SECONDS))
    val newer = requests.submitPick("B", file())
    assertFalse(old.await().failed)
    assertNull(old.await().file)
    assertEquals("new", newer.await().file?.readText())
    release.countDown(); Thread.sleep(50)
    assertTrue(late.closed); assertFalse(a.exists())
    requests.destroyAll()
  }

  @Test fun capFailsFastAndDestroySettlesPending() {
    val entered = CountDownLatch(2)
    val release = CountDownLatch(1)
    val streams = mutableListOf<TrackingStream>()
    val requests = BackupIngressRequests(opener = { source ->
      entered.countDown(); waitForProvider(release)
      TrackingStream(source).also { synchronized(streams) { streams.add(it) } }
    }, cap = 2, workers = 2)
    val a = file(); requests.submitPick("A", a)
    val b = file(); requests.submitShare("B", b)
    assertTrue(entered.await(1, TimeUnit.SECONDS))
    val c = file(); assertTrue(requests.submitPick("C", c).await().failed)
    val pending = requests.consumeShare()
    requests.destroyAll()
    assertTrue(pending.await().failed)
    release.countDown(); Thread.sleep(50)
    assertFalse(a.exists()); assertFalse(b.exists()); assertFalse(c.exists())
    assertTrue(streams.all { it.closed })
  }

  private class TrackingStream(value: String) : ByteArrayInputStream(value.toByteArray()) {
    var closed = false
    override fun close() { closed = true; super.close() }
  }
}
