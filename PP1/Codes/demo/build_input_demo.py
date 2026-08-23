"""
Build short MP4 demo clips from UR Dataset PNG sequences for PP1 input slide.

Outputs (saved to outputs/demo_videos/):
    ur_fall_demo.mp4       - one fall sequence
    ur_adl_demo.mp4        - one daily-activity sequence
    ur_side_by_side.mp4    - both clips playing together (fall | ADL)

Run from repo root:
    python Codes/demo/build_input_demo.py
"""

from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import imageio.v2 as imageio

REPO_ROOT = Path(__file__).resolve().parents[2]
UR_ROOT = REPO_ROOT / "datasets" / "UR Dataset"
OUT_DIR = REPO_ROOT / "outputs" / "demo_videos"
OUT_DIR.mkdir(parents=True, exist_ok=True)

FALL_FOLDER = UR_ROOT / "falls" / "cam0" / "fall-01-cam0-rgb"
ADL_FOLDER = UR_ROOT / "adl" / "adl-01-cam0-rgb"

FPS = 25
LABEL_HEIGHT = 50


def load_frames(folder: Path) -> list[np.ndarray]:
    files = sorted(folder.glob("*.png"))
    if not files:
        raise FileNotFoundError(f"No PNGs in {folder}")
    return [np.asarray(Image.open(f).convert("RGB")) for f in files]


def add_label(frame: np.ndarray, text: str) -> np.ndarray:
    h, w = frame.shape[:2]
    canvas = np.zeros((h + LABEL_HEIGHT, w, 3), dtype=np.uint8)
    canvas[LABEL_HEIGHT:] = frame
    img = Image.fromarray(canvas)
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("arial.ttf", 28)
    except OSError:
        font = ImageFont.load_default()
    draw.text((15, 10), text, fill=(255, 255, 255), font=font)
    return np.asarray(img)


def write_video(frames: list[np.ndarray], out_path: Path, fps: int = FPS) -> None:
    with imageio.get_writer(str(out_path), fps=fps, codec="libx264", quality=8) as writer:
        for f in frames:
            writer.append_data(f)
    print(f"  wrote {out_path}  ({len(frames)} frames @ {fps} fps)")


def build_side_by_side(fall: list[np.ndarray], adl: list[np.ndarray]) -> list[np.ndarray]:
    n = min(len(fall), len(adl))
    out = []
    for i in range(n):
        left = add_label(fall[i], "FALL  (UR Dataset)")
        right = add_label(adl[i], "DAILY ACTIVITY  (UR Dataset)")
        if right.shape != left.shape:
            right_img = Image.fromarray(right).resize((left.shape[1], left.shape[0]))
            right = np.asarray(right_img)
        out.append(np.hstack([left, right]))
    return out


def main() -> None:
    print("Loading frames...")
    fall = load_frames(FALL_FOLDER)
    adl = load_frames(ADL_FOLDER)
    print(f"  fall-01: {len(fall)} frames")
    print(f"  adl-01:  {len(adl)} frames")

    print("\nWriting individual clips...")
    write_video(fall, OUT_DIR / "ur_fall_demo.mp4")
    write_video(adl, OUT_DIR / "ur_adl_demo.mp4")

    print("\nWriting side-by-side clip...")
    sbs = build_side_by_side(fall, adl)
    write_video(sbs, OUT_DIR / "ur_side_by_side.mp4")

    print(f"\nDone. Videos saved to: {OUT_DIR}")


if __name__ == "__main__":
    main()
