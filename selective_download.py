import gdown
import os

url = "https://drive.google.com/drive/folders/1oCKYXB7pljPZG6sdVNmT4ZgyHcwl8xBL?usp=sharing"
output_dir = "./downloaded_hub"

print("Listing files in Google Drive folder...")
files = gdown.download_folder(url=url, output=output_dir, skip_download=True)

print(f"Total files found in Google Drive: {len(files)}")

download_count = 0
skipped_count = 0

for idx, file in enumerate(files):
    # Depending on gdown version, file could be a dict or an object
    # Let's inspect file attributes safely
    try:
        fid = file.id if hasattr(file, 'id') else file['id']
        fpath = file.path if hasattr(file, 'path') else file['path']
        flocal = file.local_path if hasattr(file, 'local_path') else file['local_path']
    except Exception as e:
        print(f"Error accessing file item {idx}: {e}")
        continue

    # Filter out node_modules and .git
    if "node_modules" in fpath or ".git" in fpath or "node_modules" in flocal or ".git" in flocal:
        skipped_count += 1
        continue

    # Clean the path to make sure it's correct
    print(f"Downloading [{idx+1}/{len(files)}]: {fpath}")
    
    # Ensure local directory exists
    local_dir = os.path.dirname(flocal)
    if local_dir:
        os.makedirs(local_dir, exist_ok=True)
        
    try:
        gdown.download(id=fid, output=flocal, quiet=True)
        download_count += 1
    except Exception as e:
        print(f"Failed to download {fpath}: {e}")

print(f"\nDownload finished! Downloaded: {download_count}, Skipped: {skipped_count}")
