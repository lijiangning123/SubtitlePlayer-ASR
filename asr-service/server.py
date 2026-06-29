from __future__ import annotations

import argparse
import importlib.util
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware


APP_DIR = Path(__file__).resolve().parent

app = FastAPI(title="SubtitlePlayer ASR Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


def _safe_suffix(filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    return suffix if suffix and len(suffix) <= 10 else ".mp4"


async def _save_upload(upload: UploadFile, work_dir: Path) -> Path:
    input_path = work_dir / ("input" + _safe_suffix(upload.filename or "input.mp4"))
    with input_path.open("wb") as f:
        while chunk := await upload.read(1024 * 1024):
            f.write(chunk)
    return input_path


def _run(cmd: list[str], timeout: int) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        text=True,
        capture_output=True,
        timeout=timeout,
        check=False,
        encoding="utf-8",
        errors="replace",
    )


def resolve_videocaptioner_command() -> list[str] | None:
    script_dir = Path(sys.executable).parent
    candidates = [
        script_dir / "videocaptioner.exe",
        script_dir / "videocaptioner",
        APP_DIR / "runtime" / "python" / "Scripts" / "videocaptioner.exe",
        APP_DIR / "runtime" / "python" / "Scripts" / "videocaptioner",
    ]
    for candidate in candidates:
        if candidate.exists():
            return [str(candidate)]

    cli = shutil.which("videocaptioner")
    if cli:
        return [cli]

    if importlib.util.find_spec("videocaptioner"):
        return [sys.executable, "-m", "videocaptioner"]
    return None


def resolve_ffmpeg_command() -> str | None:
    candidates = [
        APP_DIR / "runtime" / "ffmpeg" / "bin" / "ffmpeg.exe",
        APP_DIR / "runtime" / "ffmpeg" / "ffmpeg.exe",
    ]
    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
    return shutil.which("ffmpeg")


def transcribe_with_videocaptioner(
    input_path: Path,
    engine: str,
    language: str,
    output_format: str,
    timeout: int,
) -> str:
    cli_cmd = resolve_videocaptioner_command()
    if not cli_cmd:
        raise RuntimeError("videocaptioner CLI was not found")

    output_path = input_path.with_suffix(f".{output_format}")
    cmd = [
        *cli_cmd,
        "transcribe",
        str(input_path),
        "--asr",
        engine,
        "--language",
        language,
        "--format",
        output_format,
        "-o",
        str(output_path),
        "--quiet",
    ]
    result = _run(cmd, timeout)
    if result.returncode != 0:
        raise RuntimeError((result.stderr or result.stdout or "videocaptioner transcription failed").strip())
    if not output_path.exists():
        raise RuntimeError("videocaptioner did not create a subtitle file")
    return output_path.read_text(encoding="utf-8")


def extract_audio(input_path: Path, work_dir: Path, timeout: int) -> Path:
    ffmpeg = resolve_ffmpeg_command()
    if not ffmpeg:
        raise RuntimeError("ffmpeg was not found")

    audio_path = work_dir / "audio.mp3"
    cmd = [
        ffmpeg,
        "-y",
        "-i",
        str(input_path),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-f",
        "mp3",
        str(audio_path),
    ]
    result = _run(cmd, timeout)
    if result.returncode != 0 or not audio_path.exists():
        raise RuntimeError((result.stderr or "ffmpeg audio extraction failed").strip())
    return audio_path


def transcribe_with_openai(input_path: Path, work_dir: Path, language: str, timeout: int) -> str:
    try:
        from openai import OpenAI
    except ImportError as exc:
        raise RuntimeError("openai package is not installed") from exc

    if not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError("OPENAI_API_KEY is not set")

    audio_path = extract_audio(input_path, work_dir, timeout)
    client = OpenAI(base_url=os.getenv("OPENAI_BASE_URL") or None)
    model = os.getenv("OPENAI_TRANSCRIBE_MODEL", "whisper-1")
    with audio_path.open("rb") as audio:
        kwargs = {"model": model, "file": audio, "response_format": "srt"}
        if language != "auto":
            kwargs["language"] = language
        return client.audio.transcriptions.create(**kwargs)


@app.get("/api/health")
def health() -> dict[str, bool | str | None]:
    cli_cmd = resolve_videocaptioner_command()
    ffmpeg = resolve_ffmpeg_command()
    return {
        "ok": True,
        "videocaptioner": cli_cmd is not None,
        "videocaptioner_command": " ".join(cli_cmd) if cli_cmd else None,
        "ffmpeg": ffmpeg is not None,
        "ffmpeg_command": ffmpeg,
    }


@app.post("/api/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    provider: Literal["videocaptioner", "openai"] = Form("videocaptioner"),
    engine: str = Form("bijian"),
    language: str = Form("zh"),
    format: Literal["srt"] = Form("srt"),
    timeout_seconds: int = Form(3600),
) -> dict[str, str]:
    with tempfile.TemporaryDirectory(prefix="subtitleplayer-asr-") as tmp:
        work_dir = Path(tmp)
        input_path = await _save_upload(file, work_dir)
        try:
            if provider == "openai" or engine == "whisper-api":
                srt = transcribe_with_openai(input_path, work_dir, language, timeout_seconds)
                used_provider = "openai"
            else:
                srt = transcribe_with_videocaptioner(input_path, engine, language, format, timeout_seconds)
                used_provider = "videocaptioner"
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {
        "filename": file.filename or "video",
        "provider": used_provider,
        "engine": engine,
        "format": "srt",
        "srt": srt,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Run SubtitlePlayer ASR service")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=28768)
    args = parser.parse_args()

    import uvicorn

    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
