import urllib.request
import re
import os
import sys
from bs4 import BeautifulSoup
import gdown

output_base = "./downloaded_hub"
os.makedirs(output_base, exist_ok=True)

# Folders to scrape recursively
target_folders = {
    "sovereigns": "1wkiESreCB8JjCsWht-abfHei79nLWBjp",
    "sovereigns-banking-hub": "1fZBuXHBGCCfSI0YNvACsLcMHZebaEmjA",
    "public": "12mhwnr2EzQuT7HbF8tF6dJDLWGGmDekg"
}

# Excluded directory names (case-insensitive)
EXCLUDED_DIRS = {"node_modules", ".git", "dist", "archive", ".next", ".temp_pdf_parse", ".github"}

def fetch_folder_contents(folder_id):
    """
    Fetches the HTML of the Google Drive embedded folderview
    and returns a list of (name, id, is_folder) tuples.
    """
    url = f"https://drive.google.com/embeddedfolderview?id={folder_id}"
    req = urllib.request.Request(
        url,
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36'}
    )
    try:
        with urllib.request.urlopen(req) as response:
            html = response.read().decode('utf-8')
    except Exception as e:
        print(f"Error fetching folder {folder_id}: {e}")
        return []

    soup = BeautifulSoup(html, 'html.parser')
    items = []
    
    for a in soup.find_all('a'):
        href = a.get('href', '')
        text = a.get_text().strip()
        if not text or not href:
            continue
            
        # Check if it is a folder
        if "drive/folders/" in href:
            # Extract folder ID
            match = re.search(r'folders/([a-zA-Z0-9_\-]+)', href)
            if match:
                items.append((text, match.group(1), True))
        # Check if it is a file
        elif "file/d/" in href:
            match = re.search(r'file/d/([a-zA-Z0-9_\-]+)', href)
            if match:
                items.append((text, match.group(1), False))
                
    return items

def download_recursive(folder_id, local_path):
    print(f"\nScanning directory: {local_path} (ID: {folder_id})")
    os.makedirs(local_path, exist_ok=True)
    
    items = fetch_folder_contents(folder_id)
    print(f"Found {len(items)} items in {local_path}")
    
    for name, item_id, is_folder in items:
        if is_folder:
            if name.lower() in EXCLUDED_DIRS:
                print(f"Skipping excluded folder: {name}")
                continue
            sub_path = os.path.join(local_path, name)
            download_recursive(item_id, sub_path)
        else:
            file_dest = os.path.join(local_path, name)
            print(f"Downloading file: {name} ({item_id}) -> {file_dest}")
            try:
                gdown.download(id=item_id, output=file_dest, quiet=True)
            except Exception as e:
                print(f"Failed to download file {name}: {e}")

if __name__ == "__main__":
    # Scrape the three main target subfolders
    for folder_name, folder_id in target_folders.items():
        local_dir = os.path.join(output_base, folder_name)
        download_recursive(folder_id, local_dir)
        
    print("\n=== SMART RECURSIVE DOWNLOAD COMPLETED! ===")
