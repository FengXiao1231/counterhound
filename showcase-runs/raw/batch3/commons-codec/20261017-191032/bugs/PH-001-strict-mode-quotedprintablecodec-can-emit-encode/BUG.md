# Strict-mode QuotedPrintableCodec can emit encoded lines longer than 76 characters

| | |
|---|---|
| Function | `org.apache.commons.codec.net.QuotedPrintableCodec.encodeQuotedPrintable` in `src/main/java/org/apache/commons/codec/net/QuotedPrintableCodec.java` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.82, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** 74 bytes: 'a' x70, 0x00, 0x00, 'a', 'a'; QuotedPrintableCodec(true).encode

**Expected:** every line <= 76 characters

**Actual:** first line is 70 'a' + '=00=00' + '=' = 77 characters; the soft break after the third-from-last octet is emitted without checking that the encoded octet fits

## Reproduce

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

Fails with `AssertionError: line length 77: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa=00=00= ==> expected: <true> but was: <false>`

Copy it into `src/test/java/` under its package directory (it uses JUnit 5) and run `mvn test -Dtest=ReproStrictLineLengthTest` or `gradle test --tests '*ReproStrictLineLengthTest'`.

## Why this is a bug

strict mode 'implements the full ruleset' of RFC 1521, whose rule #5 limits encoded lines to 76 characters; the code defines SAFE_LENGTH=73 to guarantee this but the third-from-last octet handling (pos += 3 then soft break when pos > SAFE_LENGTH-2) overshoots it

Independent review: Strict mode is documented as implementing the full RFC 1521 ruleset, including rule #5 (lines of at most 76 characters including the trailing '='). Tracing the source: after 70 'a' and the first 0x00 at index 70, pos is 74. The third-from-last octet (0x00 at index 71) is then encoded unconditionally, giving pos 77, and the soft-break check `pos > SAFE_LENGTH-2` appends '=', so the line has 77 characters. The same overshoot is reachable in the main loop: `pos < SAFE_LENGTH` allows an encoded 3-byte write from pos 72, so a later encoded octet followed by '=' can reach 78. A fix is to break before writing an encoded octet that would not fit. A maintainer would likely accept that, though the severity is low because few callers use strict mode with binary input.

## How it was found

Property: *in strict mode (full RFC 1521 ruleset) every encoded line, including the trailing '=' of a soft break, is at most 76 characters*.

QuickTheories shrank the failure to: `Failing test case: [32, 32, 32, 13, 32, 13, 13, 32, 32, 32, 32, 32, 32, 32, 13, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 13, 32, 32, 13, 13, 13, 32, 32, 32, 32, 32, 32, 32, 32, 13, 32, 32, 13, 13, 32, 32, 13, 32, 32, 32]`

---
Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
