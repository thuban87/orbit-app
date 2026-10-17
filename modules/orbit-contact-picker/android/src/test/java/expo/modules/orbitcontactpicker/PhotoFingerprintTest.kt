package expo.modules.orbitcontactpicker

import java.io.ByteArrayInputStream
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PhotoFingerprintTest {
  @Test fun knownVectorForAbc() {
    assertEquals(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      photoFingerprint("abc".toByteArray(Charsets.US_ASCII)),
    )
  }

  @Test fun emptyInputHashesToTheEmptyDigest() {
    assertEquals(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      photoFingerprint(ByteArray(0)),
    )
  }

  @Test fun outputIsLowercaseHexOfLength64() {
    val fingerprint = photoFingerprint(ByteArray(300) { index -> (index * 7).toByte() })
    assertEquals(64, fingerprint.length)
    assertTrue(fingerprint.matches(Regex("^[0-9a-f]{64}$")))
  }

  @Test fun streamFormMatchesByteForm() {
    val bytes = ByteArray(20_000) { index -> (index % 251).toByte() }
    assertEquals(photoFingerprint(bytes), photoFingerprint(ByteArrayInputStream(bytes)))
  }
}
