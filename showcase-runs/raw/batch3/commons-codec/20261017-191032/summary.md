<!-- proofhound-report -->
### proofhound found 1 provable bug

Checked 12 functions in 2 modules with property-based tests. 1 reported → 1 reproduced → 1 unique → 1 confirmed by an independent review.

<details><summary><b>PH-001</b> Strict-mode QuotedPrintableCodec can emit encoded lines longer than 76 characters <sub>(wrong result, src/main/java/org/apache/commons/codec/net/QuotedPrintableCodec.java)</sub></summary>

| | |
|---|---|
| Function | `org.apache.commons.codec.net.QuotedPrintableCodec.encodeQuotedPrintable` |
| Input | 74 bytes: 'a' x70, 0x00, 0x00, 'a', 'a'; QuotedPrintableCodec(true).encode |
| Expected | every line <= 76 characters |
| Actual | first line is 70 'a' + '=00=00' + '=' = 77 characters; the soft break after the third-from-last octet is emitted without checking that the encoded octet fits |
| Review | low severity, confidence 0.82 |

Strict mode is documented as implementing the full RFC 1521 ruleset, including rule #5 (lines of at most 76 characters including the trailing '='). Tracing the source: after 70 'a' and the first 0x00 at index 70, pos is 74. The third-from-last octet (0x00 at index 71) is then encoded unconditionally, giving pos 77, and the soft-break check `pos > SAFE_LENGTH-2` appends '=', so the line has 77 characters. The same overshoot is reachable in the main loop: `pos < SAFE_LENGTH` allows an encoded 3-byte write from pos 72, so a later encoded octet followed by '=' can reach 78. A fix is to break befor

Failing test (`ReproStrictLineLengthTest.java`, failed 3/3 runs):

```java
package org.apache.commons.codec.net;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ReproStrictLineLengthTest {
    @Test
    void lineWithSoftBreakMustNotExceed76() {
        byte[] in = new byte[74];
        Arrays.fill(in, (byte) 'a');
        in[70] = 0;
        in[71] = 0;
        String out = new String(new QuotedPrintableCodec(true).encode(in), StandardCharsets.US_ASCII);
        for (String line : out.split("\r\n", -1)) {
            assertTrue(line.length() <= 76, "line length " + line.length() + ": " + line);
        }
    }
}
```
</details>

<sub>1m40s · $0.50 of model usage · [proofhound](https://github.com/FengXiao1231/proofhound) only reports failures that replay deterministically and survive review.</sub>
