#!/usr/bin/env python3
"""Quick test for notation normalization."""
import re

s = "d.n.p.d.n p.d.S.n"
print("Input:", repr(s))

# The regex pattern from the code
pattern = r"(?<![.])([SRGmMPDNrgdn][']*)\x2e([SRGmMPDNrgdn])(?=[']*(?:\.|[\s]|$))"
print("Pattern:", pattern)

result = re.sub(pattern, lambda m: m.group(1) + " " + m.group(2), s)
print("After pass 1:", repr(result))
result = re.sub(pattern, lambda m: m.group(1) + " " + m.group(2), result)
print("After pass 2:", repr(result))

# Simpler approach: just replace single dots between note letters
def expand_dots(s):
    """Replace single dots between sargam letters with spaces."""
    # Match: note-letter[octave] DOT note-letter (not preceded by another dot)
    return re.sub(
        r"([SRGmMPDNrgdn][']?)\.(?=[SRGmMPDNrgdn])",
        r"\1 ",
        s,
    )

s2 = "d.n.p.d.n p.d.S.n"
print("\nSimpler approach:")
print("Input:", repr(s2))
r = expand_dots(s2)
print("Result:", repr(r))
