package expo.modules.orbitsecurefetch

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.InterruptedIOException
import java.net.InetAddress
import java.net.Proxy
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import java.util.Collections
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import okhttp3.Call
import okhttp3.Callback
import okhttp3.Dns
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response

// ─── Tunable constants (single-number edits) ──────────────────────────────────
private const val CONNECT_TIMEOUT_MS = 15_000L
private const val READ_TIMEOUT_MS = 30_000L
private const val CALL_TIMEOUT_MS = 45_000L

// ─── Sanitized error codes (NO body/headers/URL/exception text ever leaks) ────
private const val ERR_INVALID_URL = "ERR_INVALID_URL"
private const val ERR_PRIVATE_ADDRESS = "ERR_PRIVATE_ADDRESS"
private const val ERR_REDIRECT = "ERR_REDIRECT"
private const val ERR_TIMEOUT = "ERR_TIMEOUT"
private const val ERR_TRANSPORT = "ERR_TRANSPORT"
private const val ERR_CANCELLED = "ERR_CANCELLED"

/** Thrown from the custom Dns when a resolved address is non-public. It extends
 * UnknownHostException so it satisfies Dns.lookup's checked signature AND is
 * distinguishable in the failure callback for a distinct sanitized code. */
internal class PrivateAddressException : UnknownHostException("blocked")

/**
 * The airtight, connection-time egress guard for the user-controlled Custom AI
 * provider (Phase 14, AI-01 / T-14-04). It wraps a single OkHttpClient whose:
 *   - custom [Dns] resolves the host ONCE, rejects the whole request unless
 *     EVERY resolved address is globally reachable, and pins the vetted IPs
 *     (closes DNS-rebinding / TOCTOU — there is no resolve-then-reconnect gap);
 *   - `.proxy(Proxy.NO_PROXY)` prevents a system HTTP/SOCKS proxy from
 *     resolving/connecting the origin on the client's behalf (C3-H2);
 *   - `.followRedirects(false)` / `.followSslRedirects(false)` refuse any 3xx
 *     natively rather than transparently following the prompt elsewhere.
 *
 * A numeric-IP-literal host is checked directly BEFORE the Call is created,
 * because OkHttp does NOT consult a custom Dns for literal hosts (C3-H1b).
 *
 * The address predicate lives in [NonPublicAddresses] so a JVM unit test can
 * exercise it against the SAME shared vector manifest the JS validator uses.
 */
class OrbitSecureFetchModule : Module() {
  // In-flight calls keyed by requestId, plus a cancelled-requestId tombstone set
  // so a cancel racing ahead of Call registration still aborts (C2-M1).
  private val inFlight = ConcurrentHashMap<String, Call>()
  private val cancelled: MutableSet<String> = Collections.synchronizedSet(mutableSetOf())

  private val secureDns = object : Dns {
    override fun lookup(hostname: String): List<InetAddress> {
      val resolved = InetAddress.getAllByName(hostname)
      if (resolved.isEmpty()) throw UnknownHostException("empty")
      // Allowlist-shaped: reject the WHOLE request unless every address is public.
      for (addr in resolved) {
        if (NonPublicAddresses.isNonPublic(addr)) throw PrivateAddressException()
      }
      return resolved.toList()
    }
  }

  private val client: OkHttpClient by lazy {
    OkHttpClient.Builder()
      .proxy(Proxy.NO_PROXY)
      .followRedirects(false)
      .followSslRedirects(false)
      .dns(secureDns)
      .connectTimeout(CONNECT_TIMEOUT_MS, TimeUnit.MILLISECONDS)
      .readTimeout(READ_TIMEOUT_MS, TimeUnit.MILLISECONDS)
      .callTimeout(CALL_TIMEOUT_MS, TimeUnit.MILLISECONDS)
      .build()
  }

  class RequestParams : Record {
    @Field var requestId: String = ""
    @Field var url: String = ""
    @Field var method: String = "POST"
    @Field var headers: Map<String, String> = emptyMap()
    @Field var body: String? = null
  }

  override fun definition() = ModuleDefinition {
    Name("OrbitSecureFetch")

    AsyncFunction("request") { params: RequestParams, promise: Promise ->
      handleRequest(params, promise)
    }

    Function("cancel") { requestId: String ->
      cancelled.add(requestId)
      inFlight[requestId]?.cancel()
    }
  }

  private fun settle(requestId: String) {
    inFlight.remove(requestId)
    cancelled.remove(requestId)
  }

  private fun handleRequest(params: RequestParams, promise: Promise) {
    val requestId = params.requestId

    // A cancel that arrived before we even started aborts immediately (C2-M1).
    if (cancelled.contains(requestId)) {
      settle(requestId)
      promise.reject(ERR_CANCELLED, "Request cancelled.", null)
      return
    }

    val httpUrl = params.url.toHttpUrlOrNull()
    if (httpUrl == null || httpUrl.scheme != "https") {
      promise.reject(ERR_INVALID_URL, "Invalid endpoint.", null)
      return
    }

    // Numeric-IP-literal pre-check (C3-H1b): the custom Dns is NOT consulted for
    // literal hosts, so guard them here before any Call is created.
    if (NonPublicAddresses.isRejectedLiteralHost(httpUrl.host)) {
      promise.reject(ERR_PRIVATE_ADDRESS, "Endpoint is not permitted.", null)
      return
    }

    val method = params.method.uppercase()
    val bodyText = params.body
    val requestBody = when {
      bodyText != null -> bodyText.toRequestBody("application/json".toMediaTypeOrNull())
      method == "POST" || method == "PUT" || method == "PATCH" || method == "DELETE" ->
        ByteArray(0).toRequestBody(null)
      else -> null
    }

    val builder = Request.Builder().url(httpUrl).method(method, requestBody)
    for ((name, value) in params.headers) {
      builder.addHeader(name, value)
    }

    val call = client.newCall(builder.build())
    inFlight[requestId] = call

    // Re-check the tombstone AFTER registration: a cancel that raced in between
    // the first check and here would otherwise no-op (C2-M1).
    if (cancelled.contains(requestId)) {
      call.cancel()
    }

    call.enqueue(object : Callback {
      override fun onFailure(call: Call, e: java.io.IOException) {
        settle(requestId)
        val code = when {
          call.isCanceled() -> ERR_CANCELLED
          e is PrivateAddressException -> ERR_PRIVATE_ADDRESS
          e is SocketTimeoutException || e is InterruptedIOException -> ERR_TIMEOUT
          else -> ERR_TRANSPORT
        }
        promise.reject(code, "Request failed.", null)
      }

      override fun onResponse(call: Call, response: Response) {
        settle(requestId)
        response.use { res ->
          // followRedirects(false) surfaces a 3xx as a normal response — reject it
          // rather than let the prompt be redirected off the vetted origin.
          if (res.code in 300..399) {
            promise.reject(ERR_REDIRECT, "Redirect refused.", null)
            return
          }
          val text = res.body?.string() ?: ""
          val finalHost = res.request.url.host
          promise.resolve(
            mapOf(
              "status" to res.code,
              "ok" to res.isSuccessful,
              "bodyText" to text,
              "finalUrlHost" to finalHost,
            ),
          )
        }
      }
    })
  }
}

/**
 * The canonical non-public address predicate — the Kotlin twin of the JS
 * `NON_PUBLIC_IPV4_CIDRS` / `NON_PUBLIC_IPV6_CIDRS` tables in
 * `src/ai/custom-endpoint.ts`. Both enforce the IDENTICAL set (IANA "reject
 * unless globally reachable"). Encoded as table constants so the JVM unit test
 * can iterate the shared vector manifest against exactly these rows (C4-H1).
 *
 * Deliberate over-block: NO globally-reachable carve-out exceptions (e.g. the
 * 192.0.0.9/.10 or 2001::/23 sub-ranges) — the owner declined them; over-blocking
 * a few exotic addresses is the intended safe direction. Do NOT add them.
 */
internal object NonPublicAddresses {
  // [baseBytes, prefixLen]. Order/prefixes mirror custom-endpoint.ts exactly.
  private val ipv4Ranges: List<Pair<ByteArray, Int>> = listOf(
    v4("0.0.0.0") to 8, // this-network / unspecified
    v4("10.0.0.0") to 8, // private
    v4("100.64.0.0") to 10, // CGNAT
    v4("127.0.0.0") to 8, // loopback
    v4("169.254.0.0") to 16, // link-local
    v4("172.16.0.0") to 12, // private
    v4("192.0.0.0") to 24, // IETF protocol assignments
    v4("192.0.2.0") to 24, // documentation (TEST-NET-1)
    v4("198.51.100.0") to 24, // documentation (TEST-NET-2)
    v4("203.0.113.0") to 24, // documentation (TEST-NET-3)
    v4("192.88.99.0") to 24, // deprecated 6to4 relay anycast
    v4("192.168.0.0") to 16, // private
    v4("198.18.0.0") to 15, // benchmarking
    v4("224.0.0.0") to 4, // multicast
    v4("240.0.0.0") to 4, // reserved
    v4("255.255.255.255") to 32, // limited broadcast
  )

  // IPv4-mapped (::ffff:0:0/96) and NAT64 (64:ff9b::/96) are unwrapped and their
  // embedded IPv4 re-checked, so they are NOT rows here — matching the JS layer.
  private val ipv6Ranges: List<Pair<ByteArray, Int>> = listOf(
    v6("::") to 128, // unspecified
    v6("::1") to 128, // loopback
    v6("64:ff9b:1::") to 48, // local-use translation
    v6("100::") to 64, // discard-only
    v6("100:0:0:1::") to 64, // dummy
    v6("2001:2::") to 48, // benchmarking
    v6("2001:db8::") to 32, // documentation
    v6("3fff::") to 20, // documentation
    v6("5f00::") to 16, // SRv6
    v6("fc00::") to 7, // ULA — Java isSiteLocalAddress() does NOT cover this
    v6("fe80::") to 10, // link-local
    v6("ff00::") to 8, // multicast
  )

  // 0..9 = 0x00, 10..11 = 0xff, low 32 bits = embedded IPv4.
  private val mappedPrefix = byteArrayOf(
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xff.toByte(), 0xff.toByte(), 0, 0, 0, 0,
  )

  // 64:ff9b:: — first 96 bits fixed, low 32 bits = embedded IPv4.
  private val nat64Prefix = byteArrayOf(
    0x00, 0x64, 0xff.toByte(), 0x9b.toByte(), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  )

  private val ipv4LiteralRe = Regex("^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$")

  private fun v4(s: String): ByteArray = InetAddress.getByName(s).address
  private fun v6(s: String): ByteArray = InetAddress.getByName(s).address

  /** True if the first [prefix] bits of [addr] equal those of [base]. */
  private fun inCidr(addr: ByteArray, base: ByteArray, prefix: Int): Boolean {
    if (addr.size != base.size) return false
    var bits = prefix
    var i = 0
    while (bits >= 8) {
      if (addr[i] != base[i]) return false
      i++
      bits -= 8
    }
    if (bits > 0) {
      val mask = (0xFF shl (8 - bits)) and 0xFF
      if ((addr[i].toInt() and mask) != (base[i].toInt() and mask)) return false
    }
    return true
  }

  private fun isNonPublicV4(b: ByteArray): Boolean =
    ipv4Ranges.any { (base, prefix) -> inCidr(b, base, prefix) }

  private fun isNonPublicV6(b: ByteArray): Boolean {
    // IPv4-mapped and NAT64: unwrap the embedded IPv4 and re-check the IPv4 set.
    if (inCidr(b, mappedPrefix, 96)) return isNonPublicV4(b.copyOfRange(12, 16))
    if (inCidr(b, nat64Prefix, 96)) return isNonPublicV4(b.copyOfRange(12, 16))
    return ipv6Ranges.any { (base, prefix) -> inCidr(b, base, prefix) }
  }

  /** The core predicate — reject unless the address is globally reachable. */
  fun isNonPublic(addr: InetAddress): Boolean {
    val bytes = addr.address
    return when (bytes.size) {
      4 -> isNonPublicV4(bytes)
      16 -> isNonPublicV6(bytes)
      else -> true // unknown family → fail closed
    }
  }

  /** Parse a dotted-decimal IPv4 literal to 4 bytes, or null if not one. */
  private fun parseV4Literal(host: String): ByteArray? {
    if (!ipv4LiteralRe.matches(host)) return null
    val parts = host.split(".")
    val out = ByteArray(4)
    for (i in 0 until 4) {
      val n = parts[i].toIntOrNull() ?: return null
      if (n > 255) return null
      out[i] = n.toByte()
    }
    return out
  }

  /**
   * True if [host] is a NUMERIC IP literal that is non-public (C3-H1b). A DNS
   * name returns false (its resolved address is the [Dns] hook's job). A literal
   * that looks like an IP but fails to parse is rejected (fail closed).
   */
  fun isRejectedLiteralHost(host: String): Boolean {
    parseV4Literal(host)?.let { return isNonPublicV4(it) }
    if (host.contains(':')) {
      // A colon means an IPv6 literal (OkHttp strips the URL brackets); parsing a
      // literal never triggers DNS. Fail closed if it will not parse.
      val addr = try {
        InetAddress.getByName(host)
      } catch (e: Exception) {
        return true
      }
      return isNonPublic(addr)
    }
    return false
  }
}
