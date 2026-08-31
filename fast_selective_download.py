import gdown
import os

output_base = "./downloaded_hub"
os.makedirs(output_base, exist_ok=True)

# List of folders to download with their gdrive folder IDs
folders_to_download = {
    "src": "1esAZSTtVheOPYGMOijT7qPnSaF1G0Aup",
    "server": "1FootxN8AiCD3AUPgZevXnNAPsUXKZUMP",
    "api": "1fRsQNNk3_XJik1Gnhyu0seHNzZrnBmwA",
    "config": "112G4oVeOKufVEkhGtO0WBw5x3dM0mV_4",
    "scripts": "14dFlf87-tBSaH62Nzyp-mt-Qsx_tI1kw",
    "sovereigns": "1wkiESreCB8JjCsWht-abfHei79nLWBjp",
    "sovereigns-banking-hub": "1fZBuXHBGCCfSI0YNvACsLcMHZebaEmjA",
    "public": "12mhwnr2EzQuT7HbF8tF6dJDLWGGmDekg"
}

# List of root files to download with their gdrive file IDs
files_to_download = {
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
    "README.md": "15Jp_zRhHO4sViJw8hCwm9LTWMscWEdao"
}

print("=== STARTING SELECTIVE SUBFOLDER DOWNLOADS ===")
for folder_name, fid in folders_to_download.items():
    local_folder = os.path.join(output_base, folder_name)
    print(f"\nDownloading folder: {folder_name} (ID: {fid}) to {local_folder}")
    try:
        # Note: gdown.download_folder creates a subdirectory named after the folder,
        # so we pass output_base as the output, and it should create output_base/folder_name
        gdown.download_folder(id=fid, output=local_folder, quiet=False, use_cookies=True)
    except Exception as e:
        print(f"Error downloading folder {folder_name}: {e}")

print("\n=== STARTING SELECTIVE ROOT FILE DOWNLOADS ===")
for filename, fid in files_to_download.items():
    local_path = os.path.join(output_base, filename)
    print(f"Downloading file: {filename} (ID: {fid}) -> {local_path}")
    try:
        gdown.download(id=fid, output=local_path, quiet=True)
    except Exception as e:
        print(f"Error downloading file {filename}: {e}")

print("\n=== DOWNLOADS COMPLETE! ===")
