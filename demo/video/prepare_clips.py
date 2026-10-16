"""Edit actual captures; waiting is condensed and never reconstructed."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parent
DEMO = ROOT.parent
OUTPUT = ROOT / "output"
OUTPUT.mkdir(exist_ok=True)


def run(args):
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def sequence(name, clips):
    parts = []
    for index, clip in enumerate(clips):
        source, seconds = clip[0], clip[1]
        start = clip[2] if len(clip) > 2 else 0
        speed = clip[3] if len(clip) > 3 else 1
        target = OUTPUT / f"{name}-part-{index}.mp4"
        args = ["-loop", "1", "-framerate", "25"] if source.suffix in (".png", ".jpg") else ["-ss", str(start)]
        filters = (f"setpts=(PTS-STARTPTS)/{speed},"
                   "scale=1920:1080:force_original_aspect_ratio=decrease,"
                   "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x080c12,setsar=1")
        run([*args, "-i", str(source), "-t", str(seconds), "-vf", filters,
             "-r", "25", "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "22",
             "-pix_fmt", "yuv420p", str(target)])
        parts.append(target)
    listing = OUTPUT / f"{name}-parts.txt"
    listing.write_text("\n".join(f"file '{part.as_posix()}'" for part in parts), encoding="utf-8")
    run(["-f", "concat", "-safe", "0", "-i", str(listing), "-c", "copy", str(ROOT / f"raw/{name}.mp4")])


sequence("ci-condensed", [
    (DEMO / "evidence/ci-running.png", 3),
    (ROOT / "raw/ci-completion.webm", 8),
    (DEMO / "evidence/ci-tests.png", 8),
    (DEMO / "evidence/ci-security.png", 10),
])

# Preserve real baseline and final state. Only the actual elapsed wait is sped up.
sequence("argo-condensed", [
    (ROOT / "raw/argocd.webm", 4, 0),
    (ROOT / "raw/argocd.webm", 14, 4, 8),
    (ROOT / "raw/argocd.webm", 10, 123),
])

sequence("aws-console", [
    (DEMO / "evidence/aws-vpc-console.jpg", 15),
    (DEMO / "evidence/aws-eks-not-provisioned.jpg", 11),
])
