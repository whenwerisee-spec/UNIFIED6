import urllib.request
import re
import os

url = "https://drive.google.com/drive/folders/1oCKYXB7pljPZG6sdVNmT4ZgyHcwl8xBL?usp=sharing"
print("Fetching HTML from Google Drive...")
req = urllib.request.Request(
    url, 
    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36'}
)

try:
    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8')
except Exception as e:
    print(f"Error: {e}")
    exit(1)

# Pattern for aria-label="..." and ssk="..."
pattern = re.compile(r'aria-label="([^"]+)".*?ssk=\'([^\'\s]+)\'', re.DOTALL)
matches = pattern.findall(html)

print(f"Found {len(matches)} potential files/folders:")
file_map = {}

for name, ssk in matches:
    # Google labels have suffixes like " Text Shared" or " Unknown Shared" or " Folder Shared"
    # Let us clean the name
    clean_name = name
    for suffix in [" Text", " Unknown", " Folder", " Shared", " Document", " Spreadsheet"]:
        clean_name = clean_name.replace(suffix, "")
    clean_name = clean_name.strip()
    
    # Extract file ID which is 33 characters starting with 1
    id_match = re.search(r'1[a-zA-Z0-9_\-]{32}', ssk)
    if id_match:
        fid = id_match.group(0)
        file_map[clean_name] = fid
        print(f"  {clean_name} -> {fid}")

# Also search for files using other patterns in case the above didn't catch all
# e.g., ["id", "name", "mimeType", ...]
print("\nScanning for other files...")
all_files = re.findall(r'\["([a-zA-Z0-9_\-]{33})","([^"]+)"', html)
for fid, fname in all_files:
    if "node_modules" not in fname and ".git" not in fname:
        file_map[fname] = fid
        print(f"  [Scanned] {fname} -> {fid}")

# Write results to JSON
with open("gdrive_files.json", "w") as f:
    import json
    json.dump(file_map, f, indent=2)

print(f"\nSaved {len(file_map)} files mapping to gdrive_files.json")
