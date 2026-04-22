import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from songbook.mapping import load_mapping, build_flat_lookup, indian_to_western

root = Path(__file__).resolve().parents[1]
mapping = load_mapping(root)
flat = build_flat_lookup(mapping)

tests = [
    ("Sa Re Ga ma Pa Dha Ni", "C D E F G A B"),
    ("pa dha ni", "g a b"),
    ("Sa' Re' Ga'", "C' D' E'"),
    ("Re(k) Ga(k) Dha(k) Ni(k)", "Db Eb Ab Bb"),
    ("Ma(T) Pa Dha", "F# G A"),
    ("Sa ni Sa: Ga: Ga Ga", "C b C: E: E E"),
]

for indian, expected in tests:
    result = indian_to_western(indian, flat)
    status = "PASS" if result == expected else "FAIL"
    print(f"{status}: {indian!r} -> {result!r} (expected {expected!r})")
