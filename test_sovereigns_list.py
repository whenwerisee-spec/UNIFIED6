import urllib.request
import re
from bs4 import BeautifulSoup

fid = "1wkiESreCB8JjCsWht-abfHei79nLWBjp"
url = f"https://drive.google.com/embeddedfolderview?id={fid}"

print(f"Fetching embedded folder view for: {fid}")
req = urllib.request.Request(
    url,
    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36'}
)

try:
    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8')
except Exception as e:
    print(f"Error fetching URL: {e}")
    exit(1)

print("Parsing page...")
soup = BeautifulSoup(html, 'html.parser')

# Find all links/items
items = []
# Google embedded folder view has items with class "folder-name-link" or "file-name-link" or script data.
# Let's search for IDs and names in the HTML using regex
all_matches = re.findall(r'\["([a-zA-Z0-9_\-]{33})","([^"]+)"', html)
print(f"Regex found {len(all_matches)} potential items:")
for item_id, name in all_matches:
    print(f"  ID: {item_id}, Name: {name}")

# Also look for links
print("\nScanning anchor tags...")
for a in soup.find_all('a'):
    href = a.get('href', '')
    text = a.get_text().strip()
    print(f"  Text: {text}, Href: {href}")
