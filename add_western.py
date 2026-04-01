import json
import re
from pathlib import Path

def indian_to_western_token(tok):
    # Mapping step
    mapping = {
        "S": "C", "R": "D", "G": "E", "m": "F", "M": "F#",
        "P": "G", "D": "A", "N": "B",
        "p": "G", "d": "A", "n": "B",
        "r": "D", "g": "E" # If they appear lowercase
    }
    
    # Octave markers
    low = False
    high = False
    
    # Handle hold ":"
    hold = ""
    if tok.endswith(":"):
        hold = ":"
        tok = tok[:-1]
        
    # User's spec for low octave = lowercase
    # But ONLY for letters, so check if the first char is lowercase
    if len(tok) >= 1 and tok[0] in ['p','d','n','r','g']:
        low = True
        
    # High octave = '
    if tok.endswith("'"):
        high = True
        tok = tok[:-1]
        
    # Komal / Tivra marked explicitly like D(k)
    komal = False
    if "(k)" in tok.lower() or "(K)" in tok.lower():
        komal = True
        tok = re.sub(r"\(k\)", "", tok, flags=re.IGNORECASE)
        
    if "(t)" in tok.lower():
        tok = re.sub(r"\(t\)", "", tok, flags=re.IGNORECASE)
        # It's M(t) usually, which maps to F# directly, but we map M -> F#
        
    char = tok[0] if len(tok) > 0 else ""
    west = mapping.get(char, char)
    
    if komal:
        west += "b" # flat
        
    # Appending octave string: let's use standard DO RE MI or C D E? 
    # C4 is standard, C3 is low, C5 is high. 
    # But C D E format with dots might be friendlier:
    # C' for high, .C for low? Let's just use matching marks C' and .C
    if low:
        west = "." + west
    if high:
        west = west + "'"
        
    return west + hold

def process_file(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    changed = False
    sections = data.get("sections", [])
    for sec in sections:
        for line in sec.get("lines", []):
            ind = line.get("indian", "")
            if ind:
                # Tokenize by splitting spaces, retaining structure?
                # Actually, some lines have mixed words "S R G"
                # Let's tokenize and replace
                tokens = ind.split()
                w_tokens = []
                for t in tokens:
                    if re.match(r"^[SRGmMPDNpgdnr][':.]*(?:b|\(k\))?", t, flags=re.IGNORECASE):
                        w_tokens.append(indian_to_western_token(t))
                    else:
                        w_tokens.append(t)
                
                new_west = " ".join(w_tokens)
                if line.get("western") != new_west:
                    line["western"] = new_west
                    changed = True
                    
    if changed:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            
    return changed

def main():
    songs_dir = Path("songs")
    c = 0
    for p in songs_dir.glob("*.json"):
        if process_file(p):
            c += 1
    print(f"Updated {c} files with western notes.")

if __name__ == "__main__":
    main()
