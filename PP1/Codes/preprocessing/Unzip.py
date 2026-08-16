import os
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from paths import UR_DATASET

# Base folders
base_dir = str(UR_DATASET)

folders_to_process = [
    os.path.join(base_dir, "adl"),
    os.path.join(base_dir, "falls", "cam0"),
    os.path.join(base_dir, "falls", "cam1")
]

def unzip_all_in_folder(folder_path):
    print(f"\nProcessing folder: {folder_path}")
    
    if not os.path.exists(folder_path):
        print(f"Folder not found: {folder_path}")
        return
    
    zip_files = [f for f in os.listdir(folder_path) if f.lower().endswith(".zip")]
    
    if not zip_files:
        print("No zip files found.")
        return
    
    for zip_name in zip_files:
        zip_path = os.path.join(folder_path, zip_name)
        
        # Extract into a folder with the same name as zip (without .zip)
        extract_folder = os.path.join(folder_path, os.path.splitext(zip_name)[0])
        
        # Skip if already extracted
        if os.path.exists(extract_folder):
            print(f"Skipped (already exists): {extract_folder}")
            continue
        
        os.makedirs(extract_folder, exist_ok=True)
        
        try:
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(extract_folder)
            print(f"Extracted: {zip_name} -> {extract_folder}")
        except Exception as e:
            print(f"Error extracting {zip_name}: {e}")

for folder in folders_to_process:
    unzip_all_in_folder(folder)

print("\nDone unzipping all files.")