package expo.modules.orbitcontactpicker

import java.io.InputStream
import java.security.MessageDigest

// Pure JVM (no android.* imports) so PhotoFingerprintTest runs on the build host.

/**
 * D-132: the phone photo's fingerprint. SHA-256 as 64 lowercase hex chars,
 * matching the hash Check linked contacts computes over the staged cache copy,
 * so a reviewed value recorded at import keeps matching later reads.
 */
fun photoFingerprint(bytes: ByteArray): String =
  MessageDigest.getInstance("SHA-256").digest(bytes).toLowercaseHex()

/** Streaming form for full-size cache copies; same output as the byte form. */
fun photoFingerprint(input: InputStream): String {
  val digest = MessageDigest.getInstance("SHA-256")
  val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
  while (true) {
    val read = input.read(buffer)
    if (read < 0) break
    digest.update(buffer, 0, read)
  }
  return digest.digest().toLowercaseHex()
}

private fun ByteArray.toLowercaseHex(): String =
  joinToString(separator = "") { byte -> "%02x".format(byte.toInt() and 0xff) }
