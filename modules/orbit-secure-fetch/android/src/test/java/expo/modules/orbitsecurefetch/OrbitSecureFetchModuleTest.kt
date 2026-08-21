package expo.modules.orbitsecurefetch

import java.io.File
import java.net.InetAddress
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Behavioral gate for the address predicate (C3-H1 / C4-H1 / C5-H1). Grep is NOT
 * sufficient for this control — this JVM test drives the SAME shared vector
 * manifest the JS validator uses (`src/ai/__fixtures__/non-public-vectors.json`),
 * asserts the module's committed test-resource copy is BYTE-IDENTICAL to it, and
 * iterates EVERY {address, expect} row through NonPublicAddresses.isNonPublic.
 */
class OrbitSecureFetchModuleTest {
  private data class Vector(val address: String, val expect: String)

  /** Walk up from the JVM working dir until the canonical manifest is found. */
  private fun findCanonicalManifest(): File? {
    var dir: File? = File(System.getProperty("user.dir") ?: ".").absoluteFile
    repeat(10) {
      val f = dir?.let { File(it, "src/ai/__fixtures__/non-public-vectors.json") }
      if (f != null && f.exists()) return f
      dir = dir?.parentFile
    }
    return null
  }

  private fun readResourceBytes(): ByteArray? =
    javaClass.getResourceAsStream("/non-public-vectors.json")?.use { it.readBytes() }

  private val vectorRe =
    Regex("\\{\\s*\"address\"\\s*:\\s*\"([^\"]*)\"\\s*,\\s*\"expect\"\\s*:\\s*\"(reject|accept)\"")

  private fun parseVectors(json: String): List<Vector> =
    vectorRe.findAll(json).map { Vector(it.groupValues[1], it.groupValues[2]) }.toList()

  /** Strip the URL brackets a vector uses for IPv6 hosts (`[::1]` -> `::1`). */
  private fun toInetAddress(address: String): InetAddress {
    val bare = if (address.startsWith("[") && address.endsWith("]")) {
      address.substring(1, address.length - 1)
    } else {
      address
    }
    // Every vector address is a numeric literal — getByName never triggers DNS.
    return InetAddress.getByName(bare)
  }

  @Test
  fun `module test resource is byte-identical to the canonical manifest`() {
    val canonical = findCanonicalManifest()
    assertNotNull("canonical non-public-vectors.json must be locatable", canonical)
    val resourceBytes = readResourceBytes()
    assertNotNull("module test-resource copy must be present on the classpath", resourceBytes)
    assertArrayEquals(
      "module test-resource manifest must be BYTE-IDENTICAL to the canonical source",
      canonical!!.readBytes(),
      resourceBytes,
    )
  }

  @Test
  fun `isNonPublic matches every shared vector`() {
    val canonical = findCanonicalManifest()
    assertNotNull(canonical)
    val vectors = parseVectors(canonical!!.readText())
    // Sanity: the manifest must actually contain the C5-H1 additions and both
    // dispositions — a silently-empty parse would make this test vacuously pass.
    assertTrue("expected a populated vector set", vectors.size >= 60)
    assertTrue(vectors.any { it.expect == "reject" })
    assertTrue(vectors.any { it.expect == "accept" })

    for (v in vectors) {
      val addr = toInetAddress(v.address)
      val actual = NonPublicAddresses.isNonPublic(addr)
      val expected = v.expect == "reject"
      assertEquals(
        "isNonPublic(${v.address}) expected=$expected",
        expected,
        actual,
      )
    }
  }

  @Test
  fun `C5-H1 additions are rejected`() {
    val additions = listOf(
      "192.88.99.1",
      "[64:ff9b:1::1]",
      "[100:0:0:1::1]",
      "[2001:2::1]",
      "[3fff::1]",
      "[5f00::1]",
    )
    for (a in additions) {
      assertTrue("$a must be non-public", NonPublicAddresses.isNonPublic(toInetAddress(a)))
    }
    assertFalse("1.1.1.1 must be public", NonPublicAddresses.isNonPublic(toInetAddress("1.1.1.1")))
    assertFalse(
      "2606:4700::1111 must be public",
      NonPublicAddresses.isNonPublic(toInetAddress("[2606:4700::1111]")),
    )
  }

  @Test
  fun `numeric-literal private hosts are rejected before any Call`() {
    // Hosts in the form OkHttp's HttpUrl.host yields (IPv6 without brackets).
    assertTrue(NonPublicAddresses.isRejectedLiteralHost("100.64.0.1"))
    assertTrue(NonPublicAddresses.isRejectedLiteralHost("127.0.0.1"))
    assertTrue(NonPublicAddresses.isRejectedLiteralHost("fd00::1"))
    assertTrue(NonPublicAddresses.isRejectedLiteralHost("::1"))
    assertTrue(NonPublicAddresses.isRejectedLiteralHost("::ffff:192.168.1.1"))
    // Public literals are permitted at the literal gate (still TLS-verified later).
    assertFalse(NonPublicAddresses.isRejectedLiteralHost("1.1.1.1"))
    assertFalse(NonPublicAddresses.isRejectedLiteralHost("2606:4700::1111"))
    // A DNS name is not a literal — deferred to the custom Dns hook.
    assertFalse(NonPublicAddresses.isRejectedLiteralHost("api.example.com"))
  }
}
