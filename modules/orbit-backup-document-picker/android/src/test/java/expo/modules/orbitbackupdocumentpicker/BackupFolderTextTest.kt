package expo.modules.orbitbackupdocumentpicker

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.IOException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class BackupFolderTextTest {
  @Test
  fun readsUtf8TextWhole() {
    val text = "{\"name\":\"Zoë Ållen\"}" + "x".repeat(20_000)
    assertEquals(text, BackupFolderText.readBounded(ByteArrayInputStream(text.toByteArray(Charsets.UTF_8))))
  }

  @Test
  fun refusesTextPastTheCeiling() {
    assertThrows(IOException::class.java) {
      BackupFolderText.readBounded(ByteArrayInputStream(ByteArray(11)), ceilingBytes = 10)
    }
  }

  @Test
  fun writesUtf8AndClosesTheStream() {
    var closed = false
    val output = object : ByteArrayOutputStream() {
      override fun close() {
        closed = true
        super.close()
      }
    }
    BackupFolderText.write(output, "{\"n\":\"Zoë\"}")
    assertEquals("{\"n\":\"Zoë\"}", output.toString(Charsets.UTF_8.name()))
    assertEquals(true, closed)
  }

  @Test
  fun aNullStreamIsAFailure() {
    assertThrows(IOException::class.java) { BackupFolderText.write(null, "{}") }
  }
}
