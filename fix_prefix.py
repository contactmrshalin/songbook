import re

with open("scrape_notation_url.py", "r") as f:
    content = f.read()

# Replace low_prefix logic in _convert_token_to_display:
# from: low_prefix = ""
#       if t.startswith(","): ...
# with handling for both, but outputting trailing dot.

# Wait, easier to just write the multi_replace block.
