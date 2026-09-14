package expo.modules.orbitopenrouterloopback

import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.util.concurrent.TimeUnit
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class OrbitOpenRouterLoopbackModuleTest {
  @Test fun `real socket accepts one exact callback and closes before delivery`() {
    val attempt = LoopbackAttempt.start("expected-state", 5_000)
    val callback = URI(attempt.callbackUrl)
    assertTrue(attempt.localAddress.isLoopbackAddress)
    assertEquals("127.0.0.1", callback.host)
    assertNotEquals(0, callback.port)
    val connection = URL("${attempt.callbackUrl}&code=one-time-code").openConnection() as HttpURLConnection
    connection.instanceFollowRedirects = false
    assertEquals(303, connection.responseCode)
    assertEquals(APP_WAKE_URI, connection.getHeaderField("Location"))
    assertFalse(connection.getHeaderField("Location").contains("code"))
    assertFalse(connection.getHeaderField("Location").contains("state"))
    val result = attempt.result.get(2, TimeUnit.SECONDS)
    assertEquals("${attempt.callbackUrl}&code=one-time-code", result.callbackUrl)
    assertTrue(attempt.isClosed())
  }

  @Test fun `wrong state does not consume attempt and next valid request resolves once`() {
    val attempt = LoopbackAttempt.start("expected", 5_000)
    assertEquals(400, responseCode("${attempt.baseUrl}?code=x&state=wrong"))
    assertFalse(attempt.result.isDone)
    assertEquals(303, responseCode("${attempt.baseUrl}?code=x&state=expected"))
    assertEquals("${attempt.baseUrl}?state=expected&code=x", attempt.result.get().callbackUrl)
    assertRefusesConnections(attempt.port)
  }

  @Test fun `malformed traffic stays bounded and does not consume attempt`() {
    val attempt = LoopbackAttempt.start("expected", 5_000)
    val invalidTargets = listOf(
      "/favicon.ico", "/openrouter-auth?state=expected",
      "/openrouter-auth?code=x&code=y&state=expected",
      "/openrouter-auth?code=x&state=expected&state=expected",
      "/openrouter-auth?code=x&state=expected&next=x",
    )
    for (target in invalidTargets) {
      assertEquals(400, rawRequest(attempt.port, "GET $target HTTP/1.1\r\nHost: 127.0.0.1:${attempt.port}\r\n\r\n"))
      assertFalse(attempt.result.isDone)
    }
    assertEquals(400, rawRequest(attempt.port, "POST /openrouter-auth?code=x&state=expected HTTP/1.1\r\nHost: 127.0.0.1:${attempt.port}\r\n\r\n"))
    assertEquals(400, rawRequest(attempt.port, "GET /openrouter-auth?code=x&state=expected HTTP/1.1\r\nHost: localhost:${attempt.port}\r\n\r\n"))
    assertEquals(303, responseCode("${attempt.baseUrl}?code=x&state=expected"))
  }

  @Test fun `early callback is retained and cancel timeout and restart release ownership`() {
    val early = LoopbackAttempt.start("early", 5_000)
    assertEquals(303, responseCode("${early.baseUrl}?code=x&state=early"))
    assertEquals("${early.baseUrl}?state=early&code=x", early.result.get().callbackUrl)
    val cancelled = LoopbackAttempt.start("cancel", 5_000)
    cancelled.cancel(ERR_CANCELLED)
    assertTrue(cancelled.result.isCompletedExceptionally)
    assertRefusesConnections(cancelled.port)
    val timedOut = LoopbackAttempt.start("timeout", 50)
    try { timedOut.result.get(2, TimeUnit.SECONDS); fail("timeout should reject") }
    catch (_: Exception) { assertTrue(timedOut.isClosed()) }
    val fresh = LoopbackAttempt.start("fresh", 5_000)
    assertTrue(fresh.port > 0)
    fresh.cancel(ERR_CANCELLED)
  }

  @Test fun `owner rejects a concurrent start and duplicate await until cleanup`() {
    val owner = LoopbackAttemptOwner()
    val first = owner.start("first", 5_000)
    try { owner.start("second", 5_000); fail("concurrent start should reject") }
    catch (failure: LoopbackFailure) { assertEquals(ERR_ACTIVE_ATTEMPT, failure.stableCode) }
    assertTrue(owner.claim(first.attemptId) === first)
    try { owner.claim(first.attemptId); fail("duplicate await should reject") }
    catch (failure: LoopbackFailure) { assertEquals(ERR_ALREADY_AWAITED, failure.stableCode) }
    owner.cancel(first.attemptId)
    val fresh = owner.start("fresh", 5_000)
    owner.cancel(fresh.attemptId)
  }

  @Test fun `oversized and slow clients cannot consume or wedge the listener`() {
    val attempt = LoopbackAttempt.start("expected", 5_000)
    val oversized = "GET /openrouter-auth?code=${"x".repeat(5_000)}&state=expected HTTP/1.1\r\nHost: 127.0.0.1:${attempt.port}\r\n\r\n"
    assertEquals(400, rawRequest(attempt.port, oversized))
    assertFalse(attempt.result.isDone)
    java.net.Socket("127.0.0.1", attempt.port).use { slow ->
      slow.getOutputStream().write("GET /openrouter-auth".toByteArray())
      slow.getOutputStream().flush()
      Thread.sleep(1_200)
    }
    assertFalse(attempt.result.isDone)
    assertEquals(303, responseCode("${attempt.baseUrl}?code=x&state=expected"))
  }

  private fun responseCode(url: String): Int {
    val connection = URL(url).openConnection() as HttpURLConnection
    connection.instanceFollowRedirects = false
    return connection.responseCode
  }
  private fun rawRequest(port: Int, request: String): Int {
    java.net.Socket("127.0.0.1", port).use { socket ->
      socket.getOutputStream().write(request.toByteArray(Charsets.US_ASCII)); socket.getOutputStream().flush()
      return BufferedReader(InputStreamReader(socket.getInputStream())).readLine().split(" ")[1].toInt()
    }
  }
  private fun assertRefusesConnections(port: Int) {
    try { java.net.Socket("127.0.0.1", port).use { fail("listener still accepted") } }
    catch (_: Exception) { /* expected */ }
  }
}
