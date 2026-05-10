import os
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from paths import UR_DATASET

base_dir = str(UR_DATASET)

folders = [
    os.path.join(base_dir, "adl"),
    os.path.join(base_dir, "falls", "cam0"),
    os.path.join(base_dir, "falls", "cam1")
]

for folder in folders:
    for subfolder in os.listdir(folder):
        subfolder_path = os.path.join(folder, subfolder)
        
        if os.path.isdir(subfolder_path):
            inner = os.listdir(subfolder_path)
            
            # Check if it has another folder inside
            if len(inner) == 1:
                inner_path = os.path.join(subfolder_path, inner[0])
                
                if os.path.isdir(inner_path):
                    # Move all files up
                    for file in os.listdir(inner_path):
                        shutil.move(os.path.join(inner_path, file), subfolder_path)
                    
                    # Remove empty inner folder
                    os.rmdir(inner_path)
                    print(f"Fixed: {subfolder_path}")