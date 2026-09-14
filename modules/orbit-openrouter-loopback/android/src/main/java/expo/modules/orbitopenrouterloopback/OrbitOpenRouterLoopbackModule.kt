package expo.modules.orbitopenrouterloopback

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.net.URLDecoder
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.CompletableFuture
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

internal const val APP_WAKE_URI = "orbit://openrouter-auth"
internal const val ERR_CANCELLED = "ERR_CANCELLED"
private const val ERR_ACTIVE_ATTEMPT = "ERR_ACTIVE_ATTEMPT"
private const val ERR_INVALID_ATTEMPT = "ERR_INVALID_ATTEMPT"
private const val ERR_ALREADY_AWAITED = "ERR_ALREADY_AWAITED"
private const val ERR_TIMEOUT = "ERR_TIMEOUT"
private const val ERR_TRANSPORT = "ERR_TRANSPORT"
private const val CALLBACK_PATH = "/openrouter-auth"
private const val MAX_REQUEST_BYTES = 4_096
private const val CLIENT_READ_TIMEOUT_MS = 1_000

internal data class LoopbackCallbackResult(val callbackUrl: String)

internal class LoopbackFailure(val stableCode: String) : Exception(stableCode)

internal class LoopbackAttempt private constructor(
  val attemptId: String,
  private val expectedState: String,
  private val server: ServerSocket,
  private val acceptExecutor: java.util.concurrent.ExecutorService,
  private val timeoutExecutor: ScheduledExecutorService,
) {
  val result = CompletableFuture<LoopbackCallbackResult>()
  private val closed = AtomicBoolean(false)
  private val awaitClaimed = AtomicBoolean(false)
  val port: Int get() = server.localPort
  val localAddress: InetAddress get() = server.inetAddress
  val baseUrl: String get() = "http://127.0.0.1:$port$CALLBACK_PATH"
  val callbackUrl: String get() = "$baseUrl?state=${encode(expectedState)}"

  fun claimAwait(): Boolean = awaitClaimed.compareAndSet(false, true)
  fun isClosed(): Boolean = closed.get()

  fun cancel(code: String = ERR_CANCELLED) {
    if (closed.compareAndSet(false, true)) {
      closeResources()
      result.completeExceptionally(LoopbackFailure(code))
    }
  }

  private fun closeResources() {
    try { server.close() } catch (_: Exception) {}
    acceptExecutor.shutdownNow()
    timeoutExecutor.shutdownNow()
  }

  private fun acceptLoop() {
    while (!closed.get()) {
      try {
        server.accept().use { handleClient(it) }
      } catch (_: SocketException) {
        if (!closed.get()) cancel(ERR_TRANSPORT)
      } catch (_: Exception) {
        if (!closed.get()) cancel(ERR_TRANSPORT)
      }
    }
  }

  private fun handleClient(socket: Socket) {
    socket.soTimeout = CLIENT_READ_TIMEOUT_MS
    val request = try { readRequest(socket) } catch (_: Exception) { null }
    val callback = request?.let { validateRequest(it) }
    if (callback == null) {
      writeResponse(socket, valid = false)
      return
    }

    // Atomically consume and close the listening socket before exposing the
    // callback to either JavaScript or the browser wake response.
    if (!closed.compareAndSet(false, true)) {
      writeResponse(socket, valid = false)
      return
    }
    try { server.close() } catch (_: Exception) {}
    writeResponse(socket, valid = true)
    result.complete(LoopbackCallbackResult(callback))
    acceptExecutor.shutdown()
    timeoutExecutor.shutdownNow()
  }

  private fun readRequest(socket: Socket): String {
    val output = ByteArrayOutputStream()
    var matched = 0
    while (output.size() < MAX_REQUEST_BYTES) {
      val next = socket.getInputStream().read()
      if (next < 0) break
      output.write(next)
      matched = when {
        matched == 0 && next == '\r'.code -> 1
        matched == 1 && next == '\n'.code -> 2
        matched == 2 && next == '\r'.code -> 3
        matched == 3 && next == '\n'.code -> 4
        next == '\r'.code -> 1
        else -> 0
      }
      if (matched == 4) return output.toString(StandardCharsets.US_ASCII.name())
    }
    throw LoopbackFailure(ERR_TRANSPORT)
  }

  private fun validateRequest(raw: String): String? {
    val lines = raw.split("\r\n")
    val requestParts = lines.firstOrNull()?.split(" ") ?: return null
    if (requestParts.size != 3 || requestParts[0] != "GET" || requestParts[2] != "HTTP/1.1") return null
    val target = requestParts[1]
    if (!target.startsWith("$CALLBACK_PATH?")) return null

    val hosts = lines.drop(1).filter { it.startsWith("Host:", ignoreCase = true) }
      .map { it.substringAfter(":").trim() }
    if (hosts.size != 1 || hosts[0] != "127.0.0.1:$port") return null

    val path = target.substringBefore('?')
    if (path != CALLBACK_PATH) return null
    val params = linkedMapOf<String, MutableList<String>>()
    for (part in target.substringAfter('?', "").split('&')) {
      if (part.isEmpty() || !part.contains('=')) return null
      val key = decode(part.substringBefore('=')) ?: return null
      val value = decode(part.substringAfter('=')) ?: return null
      params.getOrPut(key) { mutableListOf() }.add(value)
    }
    if (params.keys != setOf("code", "state")) return null
    val codes = params["code"] ?: return null
    val states = params["state"] ?: return null
    if (codes.size != 1 || codes[0].isEmpty() || states.size != 1 || states[0].isEmpty()) return null
    if (!MessageDigest.isEqual(states[0].toByteArray(), expectedState.toByteArray())) return null
    return "$baseUrl?state=${encode(states[0])}&code=${encode(codes[0])}"
  }

  private fun writeResponse(socket: Socket, valid: Boolean) {
    val response = if (valid) {
      "HTTP/1.1 303 See Other\r\nLocation: $APP_WAKE_URI\r\nCache-Control: no-store\r\nPragma: no-cache\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
    } else {
      "HTTP/1.1 400 Bad Request\r\nCache-Control: no-store\r\nPragma: no-cache\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
    }
    try {
      socket.getOutputStream().write(response.toByteArray(StandardCharsets.US_ASCII))
      socket.getOutputStream().flush()
    } catch (_: Exception) {}
  }

  companion object {
    fun start(state: String, timeoutMs: Long): LoopbackAttempt {
      if (state.isEmpty() || timeoutMs <= 0) throw LoopbackFailure(ERR_TRANSPORT)
      val server = ServerSocket()
      server.reuseAddress = false
      server.bind(InetSocketAddress(InetAddress.getByName("127.0.0.1"), 0), 8)
      val acceptExecutor = Executors.newSingleThreadExecutor()
      val timeoutExecutor = Executors.newSingleThreadScheduledExecutor()
      val attempt = LoopbackAttempt(
        UUID.randomUUID().toString(), state, server, acceptExecutor, timeoutExecutor,
      )
      acceptExecutor.execute { attempt.acceptLoop() }
      timeoutExecutor.schedule({ attempt.cancel(ERR_TIMEOUT) }, timeoutMs, TimeUnit.MILLISECONDS)
      return attempt
    }

    private fun encode(value: String): String =
      java.net.URLEncoder.encode(value, StandardCharsets.UTF_8.name()).replace("+", "%20")
    private fun decode(value: String): String? = try {
      URLDecoder.decode(value, StandardCharsets.UTF_8.name())
    } catch (_: IllegalArgumentException) { null }
  }
}

class OrbitOpenRouterLoopbackModule : Module() {
  private val lock = Any()
  private var active: LoopbackAttempt? = null

  override fun definition() = ModuleDefinition {
    Name("OrbitOpenRouterLoopback")

    AsyncFunction("startAttempt") { state: String, timeoutMs: Long, promise: Promise ->
      try {
        val attempt = synchronized(lock) {
          if (active != null) throw LoopbackFailure(ERR_ACTIVE_ATTEMPT)
          LoopbackAttempt.start(state, timeoutMs).also { active = it }
        }
        attempt.result.whenComplete { _, error ->
          if (error != null) synchronized(lock) { if (active === attempt) active = null }
        }
        promise.resolve(mapOf("attemptId" to attempt.attemptId, "callbackUrl" to attempt.callbackUrl))
      } catch (failure: LoopbackFailure) {
        promise.reject(failure.stableCode, "OpenRouter connection failed.", null)
      } catch (_: Exception) {
        promise.reject(ERR_TRANSPORT, "OpenRouter connection failed.", null)
      }
    }

    AsyncFunction("awaitCallback") { attemptId: String, promise: Promise ->
      val attempt = synchronized(lock) { active?.takeIf { it.attemptId == attemptId } }
      if (attempt == null) {
        promise.reject(ERR_INVALID_ATTEMPT, "OpenRouter connection failed.", null)
        return@AsyncFunction
      }
      if (!attempt.claimAwait()) {
        promise.reject(ERR_ALREADY_AWAITED, "OpenRouter connection failed.", null)
        return@AsyncFunction
      }
      attempt.result.whenComplete { callback, error ->
        synchronized(lock) { if (active === attempt) active = null }
        if (error != null || callback == null) {
          val code = (error?.cause as? LoopbackFailure)?.stableCode
            ?: (error as? LoopbackFailure)?.stableCode ?: ERR_TRANSPORT
          promise.reject(code, "OpenRouter connection failed.", null)
        } else {
          promise.resolve(mapOf("callbackUrl" to callback.callbackUrl))
        }
      }
    }

    AsyncFunction("cancelAttempt") { attemptId: String ->
      val attempt = synchronized(lock) {
        active?.takeIf { it.attemptId == attemptId }?.also { active = null }
      }
      attempt?.cancel(ERR_CANCELLED)
    }

    OnDestroy {
      val attempt = synchronized(lock) { active.also { active = null } }
      attempt?.cancel(ERR_CANCELLED)
    }
  }
}
