import json
import re
from pathlib import Path

def convert_to_western(ind):
    if not ind: return ""
    map_exact = {
        "Dha(k)": "Ab", "Ni(k)": "Bb", "Re(k)": "Db", "Ga(k)": "Eb",
        "Ma(T)": "F#", "Ma(t)": "F#", "M(T)": "F#", "M(t)": "F#",
        "D(k)": "Ab", "N(k)": "Bb", "R(k)": "Db", "G(k)": "Eb",
        "Sa": "C", "Re": "D", "Ga": "E", "Ma": "F", "Pa": "G", "Dha": "A", "Ni": "B",
        "S": "C", "R": "D", "G": "E", "m": "F", "M": "F#", "P": "G", "D": "A", "N": "B",
        "p": "G.", "d": "A.", "n": "B.", "r": "Db.", "g": "Eb."
    }

    # Match tokens efficiently by matching exactly the components provided.
    keys = sorted(map_exact.keys(), key=len, reverse=True)
    pattern = r"(" + "|".join(re.escape(k) for k in keys) + r")"
    
    def repl(m):
        return map_exact.get(m.group(0), m.group(0))
        
    return re.sub(pattern, repl, ind)

def main():
    songs_dir = Path("songs")
    c = 0
    for p in songs_dir.glob("*.json"):
        with open(p, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        changed = False
        sections = data.get("sections", [])
        for sec in sections:
            for line in sec.get("lines", []):
                ind = line.get("indian", "")
                if ind:
                    west = convert_to_western(ind)
                    if line.get("western") != west:
                        line["western"] = west
                        changed = True
                        
        if changed:
            with open(p, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            c += 1
            
    print(f"Updated {c} JSON files with western notes.")

if __name__ == "__main__":
    main()
