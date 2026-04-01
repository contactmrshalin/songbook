from add_western import indian_to_western_token
import re

tokens = ["S", "R", "G", "S'", "p", "D(k)", "M", "n"]
for t in tokens:
    print(t, "->", indian_to_western_token(t))
