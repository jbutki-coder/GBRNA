#!/usr/bin/env python3
"""Build data/jft-daily-audio.json from the public JFT Google Drive folders.

The source audio collection currently contains dated Just For Tonight recordings
in month folders for May through September. The script uses gdown's folder JSON
listing mode, so it retrieves metadata only and does not download the MP3 files.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlparse

MONTH_FOLDER_URLS = {
    5: "https://drive.google.com/drive/folders/1cyhtbY2p4TUjVLLL7CyatwcoIu_9eZwM",
    6: "https://drive.google.com/drive/folders/1o6WeFFCPp89MdSKcgdgYx5k8rL-AM31-",
    7: "https://drive.google.com/drive/folders/1AaA7qk6WX4DjgxGJ7v39__SSzHSwAvfh",
    8: "https://drive.google.com/drive/folders/1LBxUsbhd12to2yGxLMDVg4S0cPDuCKgI",
    9: "https://drive.google.com/drive/folders/15-_Yict-ZElKDOFXBlR3h38i6Xuocidr",
}

# Take the final date-like number before the optional ordinal suffix and .mp3.
# This handles names such as:
#   Just For Tonight May 29th.mp3
#   Just For Tonight 30th.mp3
#   Just For Tonight  Aug 16th.mp3
DAY_AT_END_RE = re.compile(
    r"(?P<day>\d{1,2})(?:st|nd|rd|th)?(?:\s*\([^)]*\))?\.mp3$",
    re.IGNORECASE,
)


def extract_file_id(url: str) -> str | None:
    match = re.search(r"/d/([^/]+)", url)
    if match:
        return match.group(1)

    query = parse_qs(urlparse(url).query)
    if query.get("id"):
        return query["id"][0]

    return None


def preference_score(filename: str) -> int:
    """Prefer obvious final/intended versions when duplicates exist."""
    name = filename.lower()
    score = 0
    if "(real)" in name or "final" in name:
        score += 20
    if "variation" in name or "bonus" in name or "test" in name:
        score -= 10
    return score


def build_map(month_items: dict[int, list[dict[str, str]]]) -> dict[str, dict[str, str]]:
    chosen: dict[str, tuple[int, dict[str, str]]] = {}

    for month, items in month_items.items():
        for item in items:
            path = item.get("path", "")
            filename = Path(path).name
            if not filename.lower().endswith(".mp3"):
                continue
            if "just for tonight" not in filename.lower():
                continue

            match = DAY_AT_END_RE.search(filename)
            if not match:
                print(f"WARNING: Could not parse JFT audio filename: {filename}", file=sys.stderr)
                continue

            day = int(match.group("day"))
            if not 1 <= day <= 31:
                print(f"WARNING: Ignoring invalid day in filename: {filename}", file=sys.stderr)
                continue

            reading_id = f"{month:02d}-{day:02d}"
            file_id = extract_file_id(item.get("url", ""))
            if not file_id:
                print(f"WARNING: Could not extract Drive ID for: {filename}", file=sys.stderr)
                continue

            entry = {
                "fileId": file_id,
                "title": filename,
                "previewUrl": f"https://drive.google.com/file/d/{file_id}/preview",
            }
            score = preference_score(filename)

            current = chosen.get(reading_id)
            if current is None or score > current[0]:
                chosen[reading_id] = (score, entry)

    return {key: chosen[key][1] for key in sorted(chosen)}


def list_drive_folder(folder_url: str) -> list[dict[str, str]]:
    gdown = shutil.which("gdown")
    if not gdown:
        raise RuntimeError("gdown is not installed. Install it with: pip install gdown==6.1.0")

    result = subprocess.run(
        [gdown, folder_url, "--folder", "--json", "--quiet"],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(
            "gdown could not list the Google Drive folder.\n"
            f"STDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
        )

    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"gdown returned invalid JSON: {exc}\nOutput:\n{result.stdout[:2000]}"
        ) from exc

    if not isinstance(data, list):
        raise RuntimeError("gdown JSON output was not a list.")
    return data


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/jft-daily-audio.json"),
    )
    args = parser.parse_args()

    month_items: dict[int, list[dict[str, str]]] = {}
    for month, folder_url in MONTH_FOLDER_URLS.items():
        print(f"Listing JFT audio month {month:02d}...")
        month_items[month] = list_drive_folder(folder_url)

    audio_map = build_map(month_items)
    print(f"Mapped {len(audio_map)} dated Just For Tonight audio recordings.")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(audio_map, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
