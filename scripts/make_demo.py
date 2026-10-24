"""Rebuild the narrated demonstration from real app screenshots and a script.

Optional tooling, separate from application dependencies:
  pip install piper-tts==1.3.0 pillow
Requires FFmpeg on PATH and the CC-BY-4.0-source VCTK medium Piper model.
Model weights and intermediary audio are intentionally not application assets.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import subprocess
import sys
import textwrap
import wave

from PIL import Image, ImageDraw, ImageFont
from piper import PiperVoice
from piper.config import SynthesisConfig

ROOT = Path(__file__).resolve().parents[1]
W, H = 1920, 1080
BG, PANEL, LINE = "#08090a", "#111619", "#29343d"
WHITE, MUTED, LIME = "#e8edf1", "#8ca1b2", "#e4f222"


def fonts(size):
    return ImageFont.truetype(str(ROOT / "public/inter.ttf"), size)


def wrap(draw, text, font, max_width):
    output, line = [], ""
    for word in text.split():
        candidate = f"{line} {word}".strip()
        if draw.textlength(candidate, font=font) > max_width and line:
            output.append(line)
            line = word
        else:
            line = candidate
    if line:
        output.append(line)
    return output


def mono(size=24):
    choices = ["/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", "/usr/share/fonts/truetype/liberation2/LiberationMono-Regular.ttf"]
    for choice in choices:
        if Path(choice).exists():
            return ImageFont.truetype(choice, size)
    return fonts(size)


def text_lines(draw, lines, xy, font, color, gap=10):
    x, y = xy
    for line in lines:
        draw.text((x, y), line, font=font, fill=color)
        y += font.size + gap
    return y


def code_card(draw, title, code, x=75, y=230, width=1240):
    draw.rounded_rectangle((x, y, x + width, y + 540), radius=14, fill="#0c1217", outline="#344856", width=2)
    draw.rounded_rectangle((x, y, x + width, y + 55), radius=14, fill="#18242d")
    draw.text((x + 25, y + 16), title, font=mono(20), fill="#8facbf")
    code_size = 23
    while code_size > 16 and max((draw.textlength(line, font=mono(code_size)) for line in code), default=0) > width - 100:
        code_size -= 1
    for i, line in enumerate(code):
        draw.text((x + 24, y + 84 + i * 33), f"{i+1:02d}", font=mono(19), fill="#3e6077")
        draw.text((x + 70, y + 82 + i * 33), line, font=mono(code_size), fill="#c1d7df" if not line.lstrip().startswith("#") else "#708e9f")


def create_frame(scene, index, work):
    canvas = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(canvas)
    draw.line((50, 114, 1870, 114), fill=LINE, width=1)
    part = "PART 1  /  CUSTOMER PILOT" if scene["part"] == 1 else "PART 2  /  TECHNICAL REVIEW"
    draw.text((58, 28), "WindProcure.", font=fonts(30), fill=WHITE)
    draw.rounded_rectangle((1420, 28, 1865, 71), radius=6, fill="#1e2527", outline="#39464b")
    draw.text((1440, 40), part, font=fonts(19), fill="#b3c29f")
    draw.text((58, 144), scene["title"], font=fonts(39), fill=WHITE)

    image_name = scene["image"]
    if image_name.endswith(".jpg"):
        source = Image.open(work / image_name).convert("RGB")
        source.thumbnail((1320, 785), Image.Resampling.LANCZOS)
        x, y = 52 + (1320 - source.width) // 2, 226 + (785 - source.height) // 2
        draw.rounded_rectangle((x - 3, y - 3, x + source.width + 3, y + source.height + 3), radius=8, outline="#31414c", width=2)
        canvas.paste(source, (x, y))
    elif image_name == "architecture":
        nodes = [
            (130, 260, 545, 130, "ELEXON STREAMS", "WINDFOR  +  FUELHH / WIND"),
            (760, 260, 555, 130, "PYTHON INGESTION", "Validate  ·  deduplicate  ·  hash"),
            (445, 490, 555, 130, "IMMUTABLE ARCHIVE", "Real records  +  provenance"),
            (445, 720, 555, 130, "PYTHON ANALYSIS → FASTAPI", "As-of selection  ·  exact joins  ·  metrics"),
        ]
        for x, y, width, height, heading, sub in nodes:
            draw.rounded_rectangle((x, y, x + width, y + height), radius=12, fill=PANEL, outline="#526575", width=2)
            draw.text((x + 28, y + 28), heading, font=fonts(23), fill="#c4d1b4")
            draw.text((x + 28, y + 76), sub, font=fonts(19), fill=MUTED)
        draw.line((675, 325, 745, 325), fill="#778c99", width=3)
        draw.polygon([(757, 325), (741, 317), (741, 333)], fill="#778c99")
        draw.line((1037, 390, 1037, 450, 722, 450, 722, 475), fill="#778c99", width=3)
        draw.polygon([(722, 487), (714, 472), (730, 472)], fill="#778c99")
        draw.line((722, 620, 722, 704), fill="#778c99", width=3)
        draw.polygon([(722, 716), (714, 701), (730, 701)], fill="#778c99")
        draw.text((445, 900), "React + TypeScript: one interface, one analytical contract", font=fonts(24), fill="#a2b1ba")
    elif image_name == "ingestion":
        code_card(draw, "backend/ingest.py", [
            'WINDFOR: publishDateTimeFrom / To',
            'FUELHH:  settlementDateFrom / To',
            '         fuelType = "WIND"',
            '',
            '# Keep target and issue time separate',
            'key = (row["startTime"], row["publishTime"])',
            '# Reject conflicting equal-publication values',
            '# Retain raw response hashes and fetchedAt',
            '',
            '64 requests → one reproducible archive',
        ])
        draw.text((95, 830), "Boundary context is retained; evaluation stays within January decisions.", font=fonts(23), fill=MUTED)
    elif image_name == "selection":
        source = (ROOT / "backend/analysis.py").read_text()
        start = source.index('    def latest(')
        code = source[start:source.index('\n    def base_day', start)].strip().splitlines()
        code_card(draw, "backend/analysis.py · actual selector", [line[4:] if line.startswith('    ') else line for line in code][:12])
        draw.text((95, 830), "Target timestamps and publication timestamps answer different questions.", font=fonts(23), fill=MUTED)
    elif image_name == "risk-code":
        code_card(draw, "backend/analysis.py · decision-time risk contract", [
            '# Previous original decision → prior delivery',
            'historical_forecast.publishTime <= prior_cutoff',
            'historical_actual.publishTime   <= current_cutoff',
            'prior_delivery_end             <= current_cutoff',
            '',
            '# Up to 14 completed delivery days',
            '# At least 48 exact matched samples',
            'scenario = max(0, empirical_quantile(errors, 0.9))',
            '',
            '# Historical scenario, not calibrated coverage',
        ])
        draw.text((95, 830), "Future revisions must not change what the decision could have known.", font=fonts(23), fill=MUTED)
    elif image_name == "api":
        code_card(draw, "backend/app.py · interface", [
            'GET /api/health',
            'GET /api/meta',
            'GET /api/day?decision_date=2026-01-14&cutoff=09:50',
            'GET /api/month?cutoff=09:50',
            'GET /api/export.csv?decision_date=2026-01-14',
            'GET /docs',
            '',
            '# Invalid decision date or cutoff → HTTP 422',
            '# API routes registered before static files',
        ])
        draw.text((95, 830), "React renders Python results; no duplicate statistical implementation.", font=fonts(23), fill=MUTED)
    elif image_name == "tests":
        code_card(draw, "verified locally · production checks", [
            '$ python -m pytest tests -q',
            '...............              [100%]',
            '15 passed',
            '',
            '$ npm run build',
            'TypeScript ✓    Vite production bundle ✓',
            '',
            'GET /                 → 200  (anonymous)',
            'GET /api/health       → 200  (anonymous)',
            'Jan 31 decision       → Feb 1 delivery',
        ])
        draw.text((95, 830), "Check the tests for leakage boundaries, units, gaps and preview parity.", font=fonts(23), fill=MUTED)
    elif image_name == "docker":
        code_card(draw, "Docker + Vercel · reproducible delivery", [
            '$ docker compose up --build',
            'http://localhost:8080',
            '',
            'Node 22: build React assets',
            'Python 3.12: run FastAPI as non-root user',
            'PORT respected · read-only Compose · health check',
            '',
            'Vercel: app.py → Python API + React static mount',
            'Archive bundled; no upstream request on page load',
        ])
        draw.text((95, 830), "Docker build not run here: Docker is unavailable. CI smoke test supplied.", font=fonts(23), fill="#bba787")

    draw.line((1402, 230, 1402, 970), fill=LINE, width=1)
    draw.text((1450, 241), "IN THIS VIEW", font=fonts(16), fill="#657f91")
    y = 300
    for i, bullet in enumerate(scene["bullets"]):
        draw.text((1450, y), f"0{i+1}", font=mono(18), fill="#91a57d")
        y = text_lines(draw, wrap(draw, bullet, fonts(29), 395), (1450, y + 35), fonts(29), "#c2d2dc", gap=10) + 54
    draw.rounded_rectangle((1448, 851, 1863, 946), radius=9, fill="#111a20", outline="#2b414e")
    draw.text((1470, 871), "REAL ELEXON DATA", font=fonts(16), fill="#9cad95")
    draw.text((1470, 905), "January 2026 decision replay", font=fonts(18), fill="#6e8da4")
    draw.line((50, 1025, 1870, 1025), fill=LINE, width=1)
    draw.text((58, 1045), "q7m4p2x9.vercel.app", font=fonts(17), fill="#8199aa")
    draw.text((780, 1045), "Generic synthesized narration · actual application views", font=fonts(15), fill="#526c80")
    draw.text((1795, 1045), f"{index+1:02d} / 15", font=mono(16), fill="#8199aa")
    destination = work / f"frame-{index:02d}.png"
    canvas.save(destination)
    return destination


def timestamp(seconds, srt=False):
    ms = round(seconds * 1000)
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    sec, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{sec:02}{',' if srt else '.'}{ms:03}"


def main(work, output):
    scenes = json.loads((ROOT / "docs/demo-scenes.json").read_text())
    work.mkdir(exist_ok=True, parents=True)
    output.parent.mkdir(exist_ok=True, parents=True)
    voice = PiperVoice.load(work / "en_GB-vctk-medium.onnx")
    config = SynthesisConfig(speaker_id=0, length_scale=0.92, noise_scale=0.5, noise_w_scale=0.6)
    durations = []
    for i, scene in enumerate(scenes):
        destination = work / f"voice-{i:02d}.wav"
        if not destination.exists():
            with wave.open(str(destination), "wb") as wav:
                voice.synthesize_wav(scene["narration"], wav, syn_config=config)
        with wave.open(str(destination)) as wav:
            seconds = wav.getnframes() / wav.getframerate()
        durations.append(seconds)
        print(f"Narration {i+1}/{len(scenes)}: {seconds:.1f}s", flush=True)
    # Preserve the two independent <=5-minute limits with slight speed adjustment
    # only if the synthesized pace would exceed a section's budget.
    # A measured, review-friendly pace, retaining pitch through FFmpeg atempo.
    part_times = {part: sum(durations[i] for i, s in enumerate(scenes) if s["part"] == part) for part in [1, 2]}
    speeds = {part: max(.82, part_times[part] / (286 - .65 * sum(s["part"] == part for s in scenes))) for part in [1, 2]}
    elapsed, captions, chapters, transcript = 0.0, [], [], ["# WindProcure demonstration\n", "Two parts, each under five minutes. Generic synthesized narration; real app views.\n"]
    part_elapsed = {1: 0.0, 2: 0.0}
    caption_id = 1
    for i, scene in enumerate(scenes):
        frame = create_frame(scene, i, work)
        speed = speeds[scene["part"]]
        duration = durations[i] / speed + .65
        part_elapsed[scene["part"]] += duration
        chapter = {"start": elapsed, "title": scene["title"], "part": scene["part"], "duration": duration}
        chapters.append(chapter)
        transcript.append(f"## {timestamp(elapsed)[:8]} — Part {scene['part']}: {scene['title']}\n\n{scene['narration']}\n")
        sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', scene["narration"]) if s.strip()]
        total_words = sum(len(s.split()) for s in sentences)
        caption_time = elapsed
        for sentence in sentences:
            allocated = (duration - .65) * len(sentence.split()) / total_words
            captions.append(f"{caption_id}\n{timestamp(caption_time, True)} --> {timestamp(caption_time + allocated, True)}\n{sentence}\n")
            caption_id += 1
            caption_time += allocated
        target = work / f"scene-{i:02d}.mp4"
        command = ['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-loop', '1', '-framerate', '12', '-i', str(frame), '-i', str(work / f'voice-{i:02d}.wav'), '-t', f'{duration:.3f}', '-af', f'atempo={speed:.6f},apad=pad_dur=0.65', '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'stillimage', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '112k', '-ar', '44100', '-movflags', '+faststart', str(target)]
        subprocess.run(command, check=True)
        print(f"Rendered scene {i+1}/{len(scenes)} ({duration:.1f}s)", flush=True)
        elapsed += duration
    assert elapsed < 600 and all(t < 300 for t in part_elapsed.values()), (elapsed, part_elapsed)
    concat = work / "concat.txt"
    concat.write_text("\n".join(f"file '{work / f'scene-{i:02d}.mp4'}'" for i in range(len(scenes))) + "\n")
    srt = output.with_suffix(".srt")
    srt.write_text("\n".join(captions))
    metadata = work / "chapters.ffmeta"
    metadata.write_text(";FFMETADATA1\ntitle=WindProcure — customer pilot and technical review\nartist=WindProcure\ncomment=Generic synthesized narration with real application screenshots.\n" + "".join(f"[CHAPTER]\nTIMEBASE=1/1000\nSTART={round(c['start']*1000)}\nEND={round((c['start']+c['duration'])*1000)}\ntitle=Part {c['part']}: {c['title']}\n" for c in chapters))
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', str(concat), '-i', str(srt), '-i', str(metadata), '-map', '0:v', '-map', '0:a', '-map', '1:0', '-map_metadata', '2', '-map_chapters', '2', '-c:v', 'copy', '-c:a', 'copy', '-c:s', 'mov_text', '-metadata:s:s:0', 'language=eng', '-movflags', '+faststart', str(output)], check=True)
    (ROOT / "docs/DEMO_SCRIPT.md").write_text("\n".join(transcript))
    summary = {"durationSeconds": elapsed, "partDurations": part_elapsed, "chapters": chapters, "voice": "Piper en_GB-vctk-medium speaker 0; VCTK source CC BY 4.0", "output": output.name}
    (work / "demo-summary.json").write_text(json.dumps(summary, indent=2))
    (ROOT / "docs/VIDEO_CHAPTERS.md").write_text("# Video chapters\n\n" + "\n".join(f"- {timestamp(c['start'])[:8]} — Part {c['part']}: {c['title']}" for c in chapters) + f"\n\nTotal: {elapsed:.1f} seconds. Part 1: {part_elapsed[1]:.1f}s. Part 2: {part_elapsed[2]:.1f}s.\n")
    print(json.dumps(summary, indent=2), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--work-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    arguments = parser.parse_args()
    main(arguments.work_dir, arguments.output)
