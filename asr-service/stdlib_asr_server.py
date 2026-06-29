from __future__ import annotations

import argparse
import cgi
import json
import os
import shutil
import subprocess
import sys
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


APP_DIR = Path(__file__).resolve().parent


def _candidate_paths() -> dict[str, list[Path]]:
    asrtools_home = os.getenv("ASRTOOLS_HOME")
    ffmpeg_env = os.getenv("FFMPEG_EXE")
    return {
        "asrtools_app": [
            Path(asrtools_home) / "app" if asrtools_home else Path(),
            APP_DIR / "runtime" / "asrtools" / "app",
            Path(r"I:\subtitleplayer\app"),
        ],
        "ffmpeg": [
            Path(ffmpeg_env) if ffmpeg_env else Path(),
            APP_DIR / "runtime" / "ffmpeg" / "bin" / "ffmpeg.exe",
            APP_DIR / "runtime" / "ffmpeg" / "ffmpeg.exe",
            Path(r"I:\subtitleplayer\ffmpeg.exe"),
        ],
    }


def resolve_asrtools_app() -> Path | None:
    for candidate in _candidate_paths()["asrtools_app"]:
        if candidate and (candidate / "bk_asr").exists():
            return candidate
    return None


def resolve_ffmpeg() -> str | None:
    for candidate in _candidate_paths()["ffmpeg"]:
        if str(candidate) and candidate.exists() and candidate.is_file():
            return str(candidate)
    return shutil.which("ffmpeg")


def _load_asr_classes():
    app_path = resolve_asrtools_app()
    if not app_path:
        raise RuntimeError("AsrTools app directory was not found")
    if str(app_path) not in sys.path:
        sys.path.insert(0, str(app_path))
    from bk_asr import BcutASR, JianYingASR, KuaiShouASR

    return {
        "bijian": BcutASR,
        "bcut": BcutASR,
        "BcutASR": BcutASR,
        "jianying": JianYingASR,
        "JianYingASR": JianYingASR,
        "kuaishou": KuaiShouASR,
        "KuaiShouASR": KuaiShouASR,
    }


def video_to_audio(input_file: Path, output_file: Path) -> None:
    ffmpeg = resolve_ffmpeg()
    if not ffmpeg:
        raise RuntimeError("ffmpeg was not found")
    output_file.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        ffmpeg,
        "-i",
        str(input_file),
        "-ac",
        "1",
        "-f",
        "mp3",
        "-af",
        "aresample=async=1",
        "-y",
        str(output_file),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if result.returncode != 0 or not output_file.exists():
        raise RuntimeError(result.stderr or "ffmpeg audio extraction failed")


def transcribe_file(input_file: Path, engine: str) -> str:
    classes = _load_asr_classes()
    asr_class = classes.get(engine) or classes["bijian"]
    audio_exts = {".mp3", ".wav"}
    if input_file.suffix.lower() in audio_exts:
        audio_file = input_file
    else:
        audio_file = input_file.with_suffix(".mp3")
        video_to_audio(input_file, audio_file)
    result = asr_class(str(audio_file), use_cache=True).run()
    return result.to_srt()


def _json_response(handler: BaseHTTPRequestHandler, status: int, body: dict) -> None:
    payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "*")
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(payload)))
    handler.end_headers()
    handler.wfile.write(payload)


class Handler(BaseHTTPRequestHandler):
    server_version = "SubtitlePlayerASR/stdlib"

    def do_OPTIONS(self) -> None:
        _json_response(self, 200, {"ok": True})

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path != "/api/health":
            _json_response(self, 404, {"detail": "not found"})
            return
        app_path = resolve_asrtools_app()
        ffmpeg = resolve_ffmpeg()
        _json_response(
            self,
            200,
            {
                "ok": True,
                "mode": "asrtools-stdlib",
                "asrtools": app_path is not None,
                "asrtools_app": str(app_path) if app_path else None,
                "videocaptioner": app_path is not None,
                "ffmpeg": ffmpeg is not None,
                "ffmpeg_command": ffmpeg,
            },
        )

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path != "/api/transcribe":
            _json_response(self, 404, {"detail": "not found"})
            return

        try:
            form = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={
                    "REQUEST_METHOD": "POST",
                    "CONTENT_TYPE": self.headers.get("Content-Type"),
                    "CONTENT_LENGTH": self.headers.get("Content-Length", "0"),
                },
            )
            file_item = form["file"]
            engine = form.getvalue("engine", "bijian")
            filename = Path(getattr(file_item, "filename", "") or "input.mp4").name
            suffix = Path(filename).suffix or ".mp4"

            with tempfile.TemporaryDirectory(prefix="subtitleplayer-asr-") as tmp:
                input_path = Path(tmp) / ("input" + suffix)
                with input_path.open("wb") as f:
                    shutil.copyfileobj(file_item.file, f)
                srt = transcribe_file(input_path, engine)

            _json_response(
                self,
                200,
                {
                    "filename": filename,
                    "provider": "asrtools",
                    "engine": engine,
                    "format": "srt",
                    "srt": srt,
                },
            )
        except Exception as exc:
            _json_response(self, 500, {"detail": str(exc)})

    def log_message(self, format: str, *args) -> None:
        print("%s - %s" % (self.address_string(), format % args))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=28768)
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"ASR service listening on http://{args.host}:{args.port}")
    print(f"AsrTools app: {resolve_asrtools_app()}")
    print(f"FFmpeg: {resolve_ffmpeg()}")
    server.serve_forever()


if __name__ == "__main__":
    main()
