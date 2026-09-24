package expo.modules.orbitsecurefetch

import java.io.IOException
import java.util.concurrent.atomic.AtomicBoolean
import okhttp3.ResponseBody
import okio.Buffer

internal const val MAX_RESPONSE_BYTES = 1024 * 1024
internal const val MAX_ERROR_BODY_BYTES = 16 * 1024
internal const val ERR_RESPONSE_TOO_LARGE = "ERR_RESPONSE_TOO_LARGE"
internal const val CANCEL_TOMBSTONE_TTL_MS = 60_000L
internal const val MAX_CANCEL_TOMBSTONES = 256

internal class ResponseTooLargeException : IOException("response too large")
internal class ResponseCancelledException : IOException("response cancelled")

/** Read only up to the cap plus one byte; check cancellation on both sides of each blocking read. */
internal fun readBounded(body: ResponseBody?, maxBytes: Int, isCanceled: () -> Boolean, truncateOnLimit: Boolean = false): String {
  if (isCanceled()) throw ResponseCancelledException()
  if (body == null) return ""
  val source = body.source()
  val buffer = Buffer()
  var total = 0L
  while (true) {
    if (isCanceled()) throw ResponseCancelledException()
    val read = try {
      source.read(buffer, minOf(8192L, maxBytes.toLong() - total + 1))
    } catch (failure: Throwable) {
      if (isCanceled()) throw ResponseCancelledException()
      throw failure
    }
    if (isCanceled()) throw ResponseCancelledException()
    if (read == -1L) break
    total += read
    if (total > maxBytes) {
      if (!truncateOnLimit) throw ResponseTooLargeException()
      return buffer.readString(maxBytes.toLong(), body.contentType()?.charset(Charsets.UTF_8) ?: Charsets.UTF_8)
    }
  }
  if (isCanceled()) throw ResponseCancelledException()
  return buffer.readString(body.contentType()?.charset(Charsets.UTF_8) ?: Charsets.UTF_8)
}

/** Both OkHttp callbacks may race cancellation; only one may settle the JS promise. */
internal class SettleOnce<T>(private val onResolve: (T) -> Unit, private val onReject: (String) -> Unit) {
  private val settled = AtomicBoolean(false)
  fun resolve(value: T) { if (settled.compareAndSet(false, true)) onResolve(value) }
  fun reject(code: String) { if (settled.compareAndSet(false, true)) onReject(code) }
}

/** Bounded cancel-before-registration record for races with request setup. */
internal class CancelTombstones(private val now: () -> Long = System::currentTimeMillis) {
  private val entries = LinkedHashMap<String, Long>()
  @Synchronized fun add(id: String) {
    val cutoff = now() - CANCEL_TOMBSTONE_TTL_MS
    entries.entries.removeAll { it.value < cutoff }
    entries.remove(id)
    entries[id] = now()
    while (entries.size > MAX_CANCEL_TOMBSTONES) entries.remove(entries.keys.first())
  }
  @Synchronized fun contains(id: String): Boolean = entries.containsKey(id)
  @Synchronized fun remove(id: String) { entries.remove(id) }
  @Synchronized fun size(): Int = entries.size
}
