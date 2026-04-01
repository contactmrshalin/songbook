import re

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

    keys = sorted(map_exact.keys(), key=len, reverse=True)
    pattern = r"(" + "|".join(re.escape(k) for k in keys) + r")"
    
    def repl(m):
        return map_exact.get(m.group(0), m.group(0))
        
    return re.sub(pattern, repl, ind)

print(convert_to_western("S R G m M P D N p d n S' M(T) D(k)"))
print(convert_to_western("Sa..Ga..Re..Ma..Ga..Ga.."))
print(convert_to_western("Ga Pa PaPa GaReSa | Sa Re GaMa ReGaRe"))
