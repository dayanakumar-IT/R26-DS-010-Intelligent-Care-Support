import os
import sys
import shutil
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from paths import NTU_DATASET

# --- 1. SET YOUR FOLDER PATHS HERE ---
# UPDATED: Pointing to the new s018_to_s032 folder
source_dir = r"C:\Users\VICTUS\Downloads\Uni\Research_PP1\nturgbd_skeletons_s018_to_s032"

# Kept the same so all files go into your master dataset folder
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

# --- 4. FILTER AND COPY FILES ---
print(f"Scanning files in {source_dir}...")
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
print(f"Done! Successfully added {copied_count} new files to your dataset folder.")