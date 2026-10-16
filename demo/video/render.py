"""Local deterministic walkthrough assembly; no cloud media services.

Inspired by AtlasForge AI's FFmpeg subprocess/ffprobe verification pattern.
Run narrate.ps1 first, then python demo/video/render.py.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DEMO = ROOT.parent
OUTPUT = ROOT / "output"


def run(arguments: list[str], timeout: int = 1200) -> str:
    result = subprocess.run(arguments, capture_output=True, text=True,
                            encoding="utf-8", errors="replace", timeout=timeout)
    if result.returncode:
        raise RuntimeError(result.stderr[-4000:])
    return result.stdout


def probe(path: Path) -> dict:
    return json.loads(run(["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)]))


def duration(path: Path) -> float:
    return float(probe(path)["format"]["duration"])


def ass_time(seconds: float) -> str:
    centis = round(seconds * 100)
    return f"{centis//360000}:{centis//6000%60:02}:{centis//100%60:02}.{centis%100:02}"


def srt_time(seconds: float) -> str:
    millis = round(seconds * 1000)
    return f"{millis//3600000:02}:{millis//60000%60:02}:{millis//1000%60:02},{millis%1000:03}"


def caption_text(text: str) -> str:
    for spoken, written in (("H T T P S", "HTTPS"), ("Fast A P I", "FastAPI"),
                            ("A P I", "API"), ("E C two", "EC2"), ("E K S", "EKS"),
                            ("K three s", "K3s"), ("T L S", "TLS"), ("S H A", "SHA"),
                            ("Argo C D", "ArgoCD")):
        text = text.replace(spoken, written)
    return text


def make_ass(title: str, caption_intervals: list[tuple[float, float, str]], seconds: float) -> str:
    header = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Caption,Arial,32,&H00F8F1E8,&H00FFFFFF,&H00120C08,&H00120C08,0,0,0,0,100,100,0,0,1,1,0,2,100,100,24,1
Style: Chapter,Arial,30,&H00F8F1E8,&H00FFFFFF,&H00120C08,&H00120C08,-1,0,0,0,100,100,0,0,1,0,0,7,44,44,20,1

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
"""
    lines = [f"Dialogue: 0,0:00:00.00,{ass_time(seconds)},Chapter,,0,0,0,,{title}"]
    for start, end, caption in caption_intervals:
        caption = r"\N".join(textwrap.wrap(caption, width=95))
        lines.append(f"Dialogue: 0,{ass_time(start)},{ass_time(end)},Caption,,0,0,0,,{caption}")
    return header + "\n".join(lines) + "\n"


def filter_path(path: Path) -> str:
    return path.resolve().as_posix().replace(":", r"\:").replace("'", r"\'")


def scene_timing(scene: dict):
    audio_files = [ROOT / "audio" / f"{scene['id']}-{i:02}.wav" for i in range(len(scene["narration"]))]
    audio_durations = [duration(path) for path in audio_files]
    seconds = sum(audio_durations) + 0.8
    intervals, position = [], 0.0
    for length, text in zip(audio_durations, scene["narration"]):
        intervals.append((position, position + length, caption_text(text)))
        position += length
    return audio_files, seconds, intervals


def build_scene(scene: dict) -> tuple[Path, float, list[tuple[float, float, str]]]:
    audio_files, seconds, intervals = scene_timing(scene)
    concat = OUTPUT / f"{scene['id']}-audio.txt"
    concat.write_text("\n".join(f"file '{path.as_posix()}'" for path in audio_files), encoding="utf-8")
    audio = OUTPUT / f"{scene['id']}.wav"
    run(["ffmpeg", "-hide_banner", "-nostdin", "-y", "-f", "concat", "-safe", "0", "-i", str(concat), "-c:a", "pcm_s16le", str(audio)])
    subtitle = OUTPUT / f"{scene['id']}.ass"
    subtitle.write_text(make_ass(scene["chapter"], intervals, seconds), encoding="utf-8")
    media = DEMO / scene["media"]
    if not media.is_file():
        raise FileNotFoundError(media)
    command = ["ffmpeg", "-hide_banner", "-nostdin", "-y"]
    if media.suffix.lower() in (".png", ".jpg", ".jpeg"):
        command += ["-loop", "1", "-framerate", "25"]
    elif scene.get("start"):
        command += ["-ss", str(scene["start"])]
    command += ["-i", str(media), "-i", str(audio)]
    # Preserve the captured UI exactly; fit it between chapter and caption bands.
    filters = ("scale=1920:900:force_original_aspect_ratio=decrease,"
               "pad=1920:1080:(ow-iw)/2:66:color=0x080c12,setsar=1,"
               f"tpad=stop_mode=clone:stop_duration={seconds},"
               f"ass='{filter_path(subtitle)}'")
    target = OUTPUT / f"{scene['id']}.mp4"
    command += ["-map", "0:v:0", "-map", "1:a:0", "-vf", filters,
                "-af", "apad,loudnorm=I=-18:TP=-1.5:LRA=9", "-t", str(seconds),
                "-r", "25", "-c:v", "libx264", "-preset", "fast", "-crf", "24",
                "-maxrate", "1400k", "-bufsize", "2800k", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-b:a", "96k", "-ar", "48000", "-ac", "1", "-movflags", "+faststart", str(target)]
    run(command)
    print(f"Built {scene['id']}: {seconds:.1f}s", flush=True)
    return target, duration(target), intervals


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only")
    parser.add_argument("--assemble-only", action="store_true", help="Package existing reviewed scene clips without rerendering them")
    args = parser.parse_args()
    OUTPUT.mkdir(exist_ok=True)
    scenes = json.loads((ROOT / "scenes.json").read_text(encoding="utf-8"))
    if args.only:
        scenes = [scene for scene in scenes if scene["id"] == args.only]
    if args.assemble_only:
        built = []
        for scene in scenes:
            target = OUTPUT / f"{scene['id']}.mp4"
            _, _, intervals = scene_timing(scene)
            built.append((target, duration(target), intervals))
    else:
        built = [build_scene(scene) for scene in scenes]
    if args.only:
        return
    timeline = []
    subtitles = []
    position = 0.0
    for scene, (path, seconds, captions) in zip(scenes, built):
        timeline.append({"id": scene["id"], "chapter": scene["chapter"], "start": round(position, 3), "duration": round(seconds, 3), "media": scene["media"]})
        for start, end, text in captions:
            subtitles.append(f"{len(subtitles)+1}\n{srt_time(position+start)} --> {srt_time(position+end)}\n{text}\n")
        position += seconds
    (DEMO / "walkthrough.srt").write_text("\n".join(subtitles), encoding="utf-8")
    (ROOT / "timeline.json").write_text(json.dumps(timeline, indent=2), encoding="utf-8")
    concat = OUTPUT / "scenes.txt"
    concat.write_text("\n".join(f"file '{path.as_posix()}'" for path, _, _ in built), encoding="utf-8")
    target = DEMO / "walkthrough.mp4"
    run(["ffmpeg", "-hide_banner", "-nostdin", "-y", "-f", "concat", "-safe", "0", "-i", str(concat), "-c", "copy", "-movflags", "+faststart", str(target)])
    result = probe(target)
    if target.stat().st_size >= 100_000_000:
        raise RuntimeError("MP4 exceeds the 100 MB delivery ceiling")
    if not 360 <= float(result["format"]["duration"]) <= 540:
        raise RuntimeError("Walkthrough duration is outside the 6–9 minute brief")
    run(["ffmpeg", "-hide_banner", "-v", "error", "-i", str(target), "-f", "null", "-"], timeout=600)
    video = next(stream for stream in result["streams"] if stream["codec_type"] == "video")
    audio = next(stream for stream in result["streams"] if stream["codec_type"] == "audio")
    if (video["width"], video["height"], video["codec_name"], audio["codec_name"]) != (1920, 1080, "h264", "aac"):
        raise RuntimeError("Unexpected delivery dimensions or codecs")
    result["format"]["filename"] = "demo/walkthrough.mp4"
    quality = {"probe": result, "bytes": target.stat().st_size,
               "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
               "full_decode": "passed", "paid_media_services": False}
    (ROOT / "quality.json").write_text(json.dumps(quality, indent=2), encoding="utf-8")
    print(f"Delivered {target}: {position:.1f}s, {target.stat().st_size/1_000_000:.1f} MB")


if __name__ == "__main__":
    main()
