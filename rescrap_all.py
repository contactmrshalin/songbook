#!/usr/bin/env python3
import json
import subprocess
from pathlib import Path

def main():
    root = Path("/Users/s0s0pna/Downloads/Songbook_Pipeline_Project")
    songs_dir = root / "songs"
    
    # Track the URLs to re-scrape
    urls_to_scrape = []
    
    for json_file in songs_dir.glob("*.json"):
        with open(json_file, "r", encoding="utf-8") as f:
            try:
                data = json.load(f)
                info = data.get("info", [])
                for line in info:
                    if line.startswith("Source: https://www.notationsworld.com"):
                        url = line.split("Source: ")[1].strip()
                        urls_to_scrape.append(url)
            except Exception as e:
                print(f"Error reading {json_file}: {e}")
                
    if not urls_to_scrape:
        print("No notationsworld dot com songs found.")
        return
        
    print(f"Found {len(urls_to_scrape)} songs to re-scrape.")
    
    # Run the scraper on all identified URLs
    for url in set(urls_to_scrape):
        print(f"\n=> Re-scraping {url}")
        subprocess.run(["python3", "scrape_notation_url.py", url], cwd=root)

if __name__ == "__main__":
    main()
