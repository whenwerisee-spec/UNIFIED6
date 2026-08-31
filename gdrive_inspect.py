import urllib.request
import re
import json
import sys
from bs4 import BeautifulSoup

url = "https://drive.google.com/drive/folders/1oCKYXB7pljPZG6sdVNmT4ZgyHcwl8xBL?usp=sharing"

print("Fetching folder page...")
req = urllib.request.Request(
    url, 
    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'}
)

try:
    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8')
except Exception as e:
    print(f"Error fetching URL: {e}")
    sys.exit(1)

print("Parsing page...")
soup = BeautifulSoup(html, 'html.parser')

# Look for script tags containing 'init' or drive state data
scripts = soup.find_all('script')
data_found = False

for script in scripts:
    content = script.string or ""
    if "window._drive_web_frontend_initial_data" in content or "_drive_fe_initial_data" in content or "initial_data" in content or "ytcfg" in content or "drive_web_frontend" in content:
        # Try to find JSON-like structures
        matches = re.findall(r'(\[\["[a-zA-Z0-9_\-]+".*?\]\])', content)
        for match in matches:
            if "1oCKYXB7pljPZG6sdVNmT4ZgyHcwl8xBL" in match:
                print("Found match in script tag:")
                print(match[:500] + "...")
                data_found = True

# Let's search for any Google Drive file or folder IDs and names using regular expressions
# A typical pattern in Google Drive JSON: ["id", "name", "mimeType", ...]
# Let's look for strings in quotes followed by commas
all_strings = re.findall(r'"([^"]+)"', html)
gdrive_ids = set()
for s in all_strings:
    if len(s) == 33 and re.match(r'^[a-zA-Z0-9_\-]+$', s):
        # looks like a GDrive ID
        gdrive_ids.add(s)

print(f"Discovered {len(gdrive_ids)} potential Google Drive IDs:")
for gid in list(gdrive_ids)[:20]:
    print(f" - {gid}")

# Let's write a simple pattern search for filenames and their IDs
# Google Drive serializes these as arrays of arrays.
# Let's try to extract files in a more robust way by printing lines containing filenames if we can find any.
# Let's look for common files like "package.json", "App.tsx", "server.ts", "index.html", etc.
for filename in ["package.json", "App.tsx", "server.ts", "vite.config.ts", "index.css", "main.tsx", "types.ts", "finance_store.json", "TransactionList.tsx", "NodesGraph.tsx", "AccountChart.tsx", "SignIn.tsx"]:
    pos = html.find(filename)
    if pos != -1:
        print(f"Found reference to: {filename} at character {pos}")
        # Print surrounding context
        context = html[max(0, pos-200):min(len(html), pos+200)]
        print(f"Context: {context}\n")
