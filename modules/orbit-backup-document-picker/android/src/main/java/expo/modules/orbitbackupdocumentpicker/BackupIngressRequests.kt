package expo.modules.orbitbackupdocumentpicker

import java.io.File
import java.io.InputStream
import java.util.concurrent.CompletableFuture
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.atomic.AtomicLong

// Plan 15 measures and obtains owner sign-off before enabling this ingress limit.
internal val BACKUP_INGRESS_ACQUIRE_MS: Long? = null
internal const val MAX_CONCURRENT_INGRESS = 4

internal data class IngressResult(val file: File? = null, val failed: Boolean = false)

/** Owns every provider acquisition, stream, destination and completion. A
 * cancelled binder acquisition retains its slot until the provider returns. */
internal class BackupIngressRequests(
  private val opener: (String) -> InputStream?,
  private val copier: BoundedBackupCopier = BoundedBackupCopier(),
  private val acquisitionMs: Long? = BACKUP_INGRESS_ACQUIRE_MS,
  private val clock: () -> Long = System::currentTimeMillis,
  private val scheduler: ScheduledExecutorService = Executors.newSingleThreadScheduledExecutor(),
  workers: Int = MAX_CONCURRENT_INGRESS,
  private val cap: Int = MAX_CONCURRENT_INGRESS,
) {
  private inner class Request(
    val generation: Long,
    val source: String,
    val destination: File,
    val kind: Kind,
    val submittedAt: Long,
  ) {
    val result = CompletableFuture<IngressResult>()
    var stream: InputStream? = null
    var work: Future<*>? = null
    var cancelled = false
    var counted = true
    var ready = false
    var started = false
  }
  internal enum class Kind { SHARE, PICK }
  private val generation = AtomicLong()
  private val executor = ThreadPoolExecutor(
    workers, workers, 0L, TimeUnit.MILLISECONDS,
    ArrayBlockingQueue<Runnable>(cap),
  )
  private val requests = mutableSetOf<Request>()
  private val shareWaiters = mutableListOf<CompletableFuture<IngressResult>>()
  private var currentShare: Request? = null
  private var currentPick: Request? = null
  private var destroyed = false
  private var occupied = 0

  @Synchronized fun submitShare(source: String, destination: File): CompletableFuture<IngressResult> =
    submit(Kind.SHARE, source, destination)

  @Synchronized fun submitPick(source: String, destination: File): CompletableFuture<IngressResult> =
    submit(Kind.PICK, source, destination)

  private fun submit(kind: Kind, source: String, destination: File): CompletableFuture<IngressResult> {
    // Supersede before cap accounting, but a blocked opener continues to own
    // its physical worker slot until it returns.
    if (kind == Kind.SHARE) currentShare?.let { cancel(it, false) }
    else currentPick?.let { cancel(it, false) }
    val request = Request(generation.incrementAndGet(), source, destination, kind, clock())
    if (kind == Kind.SHARE) currentShare = request else currentPick = request
    if (destroyed || occupied >= cap) {
      request.cancelled = true
      request.counted = false
      destination.delete()
      request.result.complete(IngressResult(failed = true))
      if (kind == Kind.SHARE) settleShareWaiters(IngressResult(failed = true))
      return request.result
    }
    occupied++
    requests.add(request)
    if (acquisitionMs != null) {
      scheduler.schedule({
        synchronized(this) {
          if (!request.ready && !request.cancelled && clock() - request.submittedAt >= acquisitionMs) {
            cancel(request, true)
          }
        }
      }, acquisitionMs, TimeUnit.MILLISECONDS)
    }
    try {
      request.work = executor.submit { run(request) }
    } catch (_: RejectedExecutionException) {
      cancel(request, true)
      release(request)
    }
    return request.result
  }

  private fun run(request: Request) {
    synchronized(this) { request.started = true }
    try {
      if (!owns(request)) return
      val input = opener(request.source) ?: throw IllegalStateException("Missing backup stream")
      synchronized(this) {
        if (!owns(request) || (acquisitionMs != null && clock() - request.submittedAt >= acquisitionMs)) {
          input.close()
          if (!request.cancelled) cancel(request, true)
          return
        }
        request.stream = input
        request.ready = true
      }
      copier.copy(input, request.destination) { owns(request) }
      synchronized(this) {
        if (owns(request)) {
          request.result.complete(IngressResult(request.destination))
          if (request.kind == Kind.SHARE) settleShareWaiters(IngressResult(request.destination))
          else currentPick = null // JS now owns the successful picked copy.
        } else request.destination.delete()
      }
    } catch (_: Exception) {
      synchronized(this) { if (owns(request)) cancel(request, true) }
    } finally {
      synchronized(this) {
        request.stream = null
        release(request)
      }
    }
  }

  @Synchronized private fun owns(request: Request): Boolean = !destroyed && !request.cancelled &&
    (if (request.kind == Kind.SHARE) currentShare === request else currentPick === request)

  private fun cancel(request: Request, failed: Boolean) {
    request.cancelled = true
    try { request.stream?.close() } catch (_: Exception) { }
    request.work?.cancel(true)
    if (!request.started) release(request)
    request.destination.delete()
    request.result.complete(IngressResult(failed = failed))
    if (request.kind == Kind.SHARE && currentShare === request && failed)
      settleShareWaiters(IngressResult(failed = true))
  }

  private fun release(request: Request) {
    if (request.counted) {
      request.counted = false
      occupied--
    }
    requests.remove(request)
  }

  private fun settleShareWaiters(result: IngressResult) {
    if (shareWaiters.isNotEmpty()) currentShare = null // JS now owns the consumed copy.
    shareWaiters.forEach { it.complete(result) }
    shareWaiters.clear()
  }

  @Synchronized fun hasShare(): Boolean = currentShare != null

  /** One-shot consume of the latest share. Waiters follow supersession. */
  @Synchronized fun consumeShare(): CompletableFuture<IngressResult> {
    val request = currentShare ?: return CompletableFuture.completedFuture(IngressResult())
    val waiter = CompletableFuture<IngressResult>()
    val completed = request.result.getNow(null)
    if (completed != null) {
      currentShare = null
      waiter.complete(completed)
    }
    else shareWaiters.add(waiter)
    return waiter
  }

  @Synchronized fun destroyAll() {
    destroyed = true
    requests.toList().forEach { cancel(it, true) }
    currentShare?.destination?.delete()
    currentPick?.destination?.delete()
    currentShare = null
    currentPick = null
    settleShareWaiters(IngressResult(failed = true))
    executor.shutdownNow()
    scheduler.shutdownNow()
  }
}
