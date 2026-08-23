import os
import sys
import shutil
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from paths import NTU_DATASET

# --- 1. SET YOUR FOLDER PATHS HERE ---
source_dir = r"C:\Users\VICTUS\Downloads\Uni\Research_PP1\nturgbd_skeletons_s001_to_s017\nturgb+d_skeletons"
dest_dir = str(NTU_DATASET)

# --- 2. DEFINE YOUR TARGET CLASSES ---
target_classes = [
    "A008.skeleton", 
    "A009.skeleton", 
    "A042.skeleton", 
    "A043.skeleton", 
    "A080.skeleton"
]

# --- 3. CREATE DESTINATION FOLDER IF IT DOESN'T EXIST ---
if not os.path.exists(dest_dir):
    os.makedirs(dest_dir)
    print(f"Created destination folder: {dest_dir}")

# --- 4. FILTER AND COPY FILES ---
print("Scanning files and copying... This might take a minute depending on your hard drive speed.")
copied_count = 0

# Look at every file in the source directory
for filename in os.listdir(source_dir):
    # Check if the file ends with any of our target class strings
    if any(filename.endswith(target) for target in target_classes):
        
        # Create full file paths
        source_file = os.path.join(source_dir, filename)
        dest_file = os.path.join(dest_dir, filename)
        
        # Copy the file over
        shutil.copy2(source_file, dest_file)
        copied_count += 1

print("--------------------------------------------------")
print(f"Done! Successfully copied {copied_count} files to your new folder.")