import gdown
import os
import json

output_base = "./downloaded_hub"
os.makedirs(output_base, exist_ok=True)

# List of folders to download selectively
folders_to_download = {
    "sovereigns": "1wkiESreCB8JjCsWht-abfHei79nLWBjp",
    "sovereigns-banking-hub": "1fZBuXHBGCCfSI0YNvACsLcMHZebaEmjA",
    "public": "12mhwnr2EzQuT7HbF8tF6dJDLWGGmDekg"
}

# Root files from gdrive_files.json with their actual file IDs
root_files = {
    "check-payment-options.ts": "174JeoPqNFJUH3NJ39dApIsXCkifYHnDB",
    "check-wise-account-balance.ts": "1MX10TPOFu_hcsNQjq56k56FMX5e3yQVq",
    "check-wise-transfer-status.ts": "14PWlfIZ47Ijm-_2tgzfX8U-FV5UCUEY_",
    "cleanup-ledger.ts": "1laLRBoIxSrIfe2CUdRajxud36TyWdAq5",
    "data_ledger.json": "1_7zdR08ipmMtshksySHEohsGCY8vkCj3",
    "deposit-30-now.ts": "1Erq3KFVC6y1E5sadKhIyJvPAuz_wXNEl",
    "etransfers.json": "1rPRTK6NK99kCmzLKYayeVfl-YcbRk1R8",
    "execute-10-dollar-transfer.ts": "1JR8GAbfSguFR3onD3D8f26KUO3h56Ool",
    "execute-30-deposit-via-server.ts": "1FOJ0sZCLBZxMuweZ7BWp5mDsuh_SY47v",
    "execute-30-dollar-transfer.ts": "1AhnwFE-9hTaXKbhH5gpLwABxg8IIUXc9",
    "fund-pending-transfer.ts": "1IVcoajxpPHkrEXN8lZHL07FaxjH3ddmo",
    "ledger_db.json": "1bHbR0karDnRQosZ_Q3BNFNyA4vuojo02",
    "ledger-to-wise.ts": "1av3qONF0BrOj0sr5hWY1NqG1tC96e68X",
    "read-ledger.ts": "17AfA91ZPBFtq7KM89ffbImXlpNmS7ILj",
    "package.json": "18E_JoXdUgVAuiTg2nz_524x38_peL-oF",
    "index.html": "10a571Sswq6R2W-MpgQA_6BbTRv1pBX2K",
    "capacitor.config.json": "1HXcmtMXrNdz7wYu2_0Ghk8GQzONGNoGT",
    "metadata.json": "1YHs7QqwbrNPYLPf3cQPOHuTSmPDTMEu8",
    "AGENTS.md": "1VqN1LyxVQOBlHYhhmhA07vF8XDo7fjYW",
    "README.md": "15Jp_zRhHO4sViJw8hCwm9LTWMscWEdao",
    "Dockerfile": "1JWFmjWwLUhPJQG67TwKB536YMAEndMxH"
}

# Let's list and download for each selective folder
for folder_name, fid in folders_to_download.items():
    local_folder = os.path.join(output_base, folder_name)
    os.makedirs(local_folder, exist_ok=True)
    print(f"\n--- Listing subfolder contents of '{folder_name}' (ID: {fid}) ---")
    
    try:
        # We list files under the subfolder
        # Note: output is the folder where listing-related files can be placed.
        # pass skip_download=True to list
        files = gdown.download_folder(id=fid, output=local_folder, skip_download=True, quiet=True, use_cookies=True)
        print(f"Found {len(files)} items in '{folder_name}'. Processing filters...")
        
        dl_count = 0
        skip_count = 0
        
        for idx, file in enumerate(files):
            try:
                fid_item = file.id if hasattr(file, 'id') else file['id']
                fpath = file.path if hasattr(file, 'path') else file['path']
                flocal = file.local_path if hasattr(file, 'local_path') else file['local_path']
            except Exception as e:
                continue
                
            path_lower = fpath.lower()
            local_lower = flocal.lower()
            
            # Exclude node_modules, .git, .next, dist
            if any(p in path_lower or p in local_lower for p in ["node_modules", ".git", ".next", "/dist/", "\\dist\\"]):
                skip_count += 1
                continue
                
            # Download file
            print(f"Downloading [{idx+1}/{len(files)}]: {fpath} -> {flocal}")
            local_dir = os.path.dirname(flocal)
            if local_dir:
                os.makedirs(local_dir, exist_ok=True)
                
            try:
                gdown.download(id=fid_item, output=flocal, quiet=True)
                dl_count += 1
            except Exception as ex:
                print(f"Error downloading '{fpath}': {ex}")
                
        print(f"Folder '{folder_name}' done. Downloaded: {dl_count}, Skipped: {skip_count}")
        
    except Exception as e:
        print(f"Error listing folder '{folder_name}': {e}")

print("\n--- Starting Selective Root File Downloads ---")
for filename, fid in root_files.items():
    local_path = os.path.join(output_base, filename)
    print(f"Downloading root file: {filename} (ID: {fid}) -> {local_path}")
    try:
        gdown.download(id=fid, output=local_path, quiet=True)
    except Exception as e:
        print(f"Error downloading root file '{filename}': {e}")

print("\n=== ALL DIRECTORIES & RELEVANT FILES DOWN-LOADED SUCCESSFULLY ===")
