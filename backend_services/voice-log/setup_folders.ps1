# Creates models/ subfolders for SCRIBE (voice-log)
New-Item -ItemType Directory -Force -Path "models\whisper_lora" | Out-Null
New-Item -ItemType Directory -Force -Path "models\bart_disfluency" | Out-Null
New-Item -ItemType Directory -Force -Path "models\t5_stage5" | Out-Null
New-Item -ItemType Directory -Force -Path "tmp" | Out-Null
Write-Host "Created models\whisper_lora, models\bart_disfluency, models\t5_stage5, tmp"
