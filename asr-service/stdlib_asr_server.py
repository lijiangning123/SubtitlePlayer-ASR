from __future__ import annotations

import argparse
import cgi
import json
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
import socket
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


APP_DIR = Path(__file__).resolve().parent
SUMMARY_API_TIMEOUT = int(os.getenv("SUMMARY_API_TIMEOUT", "300"))


def _candidate_paths() -> dict[str, list[Path]]:
    ffmpeg_env = os.getenv("FFMPEG_EXE")
    return {
        "asrtools_app": [
            APP_DIR / "runtime" / "asrtools" / "app",
        ],
        "ffmpeg": [
            Path(ffmpeg_env) if ffmpeg_env else Path(),
            APP_DIR / "runtime" / "ffmpeg" / "bin" / "ffmpeg.exe",
            APP_DIR / "runtime" / "ffmpeg" / "ffmpeg.exe",
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


def _read_json_file(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def _file_text(path: Path) -> str:
    if path.exists():
        return path.read_text(encoding="utf-8").strip()
    return ""


def load_summary_config() -> dict:
    raw = _read_json_file(APP_DIR / "summary-config.json")
    provider = (
        os.getenv("SUMMARY_PROVIDER")
        or raw.get("provider")
        or "openai"
    ).strip().lower()
    section = raw.get(provider, {}) if isinstance(raw.get(provider), dict) else {}

    def pick(*names: str, default: str = "") -> str:
        for name in names:
            value = os.getenv(name)
            if value:
                return value.strip()
        for name in names:
            key = name.lower()
            for source in (section, raw):
                value = source.get(key) or source.get(name) or source.get(_camel_name(key))
                if not value and key.endswith("_api_key"):
                    value = source.get("apiKey")
                if not value and key.endswith("_model"):
                    value = source.get("model")
                if not value and key.endswith("_base_url"):
                    value = source.get("baseUrl") or source.get("base_url")
                if not value and key.endswith("_api_type"):
                    value = source.get("apiType") or source.get("api_type")
                if value:
                    return str(value).strip()
        return default

    if provider == "openai":
        api_key = pick("OPENAI_API_KEY") or _file_text(APP_DIR / "openai-key.txt")
        base_url = pick("OPENAI_BASE_URL", default="https://api.openai.com/v1")
        return {
            "provider": "openai",
            "api_type": "responses" if base_url.rstrip("/") == "https://api.openai.com/v1" else "chat_completions",
            "base_url": base_url,
            "api_key": api_key,
            "model": pick("OPENAI_SUMMARY_MODEL", default="gpt-5.2"),
        }

    if provider in {"qwen", "tongyi", "dashscope", "千问", "通义千问"}:
        return {
            "provider": "qwen",
            "api_type": "chat_completions",
            "base_url": pick("QWEN_BASE_URL", "DASHSCOPE_BASE_URL", default="https://dashscope.aliyuncs.com/compatible-mode/v1"),
            "api_key": pick("QWEN_API_KEY", "DASHSCOPE_API_KEY"),
            "model": pick("QWEN_SUMMARY_MODEL", "QWEN_MODEL", default="qwen-plus"),
        }

    if provider in {"doubao", "ark", "volcengine", "豆包"}:
        return {
            "provider": "doubao",
            "api_type": "chat_completions",
            "base_url": pick("DOUBAO_BASE_URL", "ARK_BASE_URL", default="https://ark.cn-beijing.volces.com/api/v3"),
            "api_key": pick("DOUBAO_API_KEY", "ARK_API_KEY"),
            "model": pick("DOUBAO_SUMMARY_MODEL", "ARK_MODEL"),
        }

    return {
        "provider": provider or "custom",
        "api_type": pick("SUMMARY_API_TYPE", default="chat_completions"),
        "base_url": pick("SUMMARY_BASE_URL"),
        "api_key": pick("SUMMARY_API_KEY"),
        "model": pick("SUMMARY_MODEL"),
    }


def public_summary_config() -> dict:
    raw = _read_json_file(APP_DIR / "summary-config.json")
    active = (raw.get("provider") or "openai").strip().lower()
    config = load_summary_config()
    defaults = summary_provider_defaults()
    providers: dict[str, dict] = {}
    for provider, default in defaults.items():
        section = raw.get(provider, {}) if isinstance(raw.get(provider), dict) else {}
        base_url = section.get("baseUrl") or section.get("base_url") or default["baseUrl"]
        api_type = section.get("apiType") or section.get("api_type") or default["apiType"]
        if provider == "openai" and str(base_url).rstrip("/") != "https://api.openai.com/v1":
            api_type = "chat_completions"
        providers[provider] = {
            "baseUrl": base_url,
            "model": section.get("model") or default["model"],
            "apiType": api_type,
            "apiKeySet": bool(section.get("apiKey") or section.get("api_key")),
        }

    return {
        "provider": active,
        "baseUrl": config.get("base_url") or "",
        "model": config.get("model") or "",
        "apiType": config.get("api_type") or "",
        "apiKeySet": bool(config.get("api_key")),
        "providers": providers,
    }


def summary_provider_defaults() -> dict[str, dict[str, str]]:
    return {
        "openai": {
            "model": "gpt-5.2",
            "baseUrl": "https://api.openai.com/v1",
            "apiType": "responses",
        },
        "qwen": {
            "model": "qwen-plus",
            "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
            "apiType": "chat_completions",
        },
        "doubao": {
            "model": "",
            "baseUrl": "https://ark.cn-beijing.volces.com/api/v3",
            "apiType": "chat_completions",
        },
        "custom": {
            "model": "",
            "baseUrl": "",
            "apiType": "chat_completions",
        },
    }


def save_summary_config(data: dict) -> dict:
    provider = str(data.get("provider") or "openai").strip().lower()
    api_key = str(data.get("apiKey") or "").strip()
    model = str(data.get("model") or "").strip()
    base_url = str(data.get("baseUrl") or "").strip()
    api_type = str(data.get("apiType") or "").strip()

    current = _read_json_file(APP_DIR / "summary-config.json")
    previous_section = current.get(provider) if isinstance(current.get(provider), dict) else {}
    existing = load_summary_config()
    if not api_key and existing.get("provider") == provider:
        api_key = existing.get("api_key", "")
    if not api_key:
        api_key = str(previous_section.get("apiKey") or previous_section.get("api_key") or "").strip()

    defaults = summary_provider_defaults()
    default = defaults.get(provider, defaults["custom"])
    model = model or str(previous_section.get("model") or "").strip() or default["model"]
    base_url = base_url or str(previous_section.get("baseUrl") or previous_section.get("base_url") or "").strip() or default["baseUrl"]
    api_type = api_type or str(previous_section.get("apiType") or previous_section.get("api_type") or "").strip() or default["apiType"]
    if provider == "openai" and base_url.rstrip("/") != "https://api.openai.com/v1":
        api_type = "chat_completions"

    if not api_key:
        raise RuntimeError("请填写 API Key")
    if not model:
        raise RuntimeError("请填写模型名称。豆包通常需要填写火山方舟控制台里的 endpoint/model id。")
    if not base_url:
        raise RuntimeError("请填写 Base URL")

    next_config = {key: value for key, value in current.items() if key.startswith("_") or key in defaults}
    next_config["provider"] = provider
    next_config[provider] = {
        "apiKey": api_key,
        "model": model,
        "baseUrl": base_url,
    }
    if provider == "custom":
        next_config[provider]["apiType"] = api_type

    config_path = APP_DIR / "summary-config.json"
    config_path.write_text(
        json.dumps(next_config, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return public_summary_config()


def _camel_name(name: str) -> str:
    parts = name.split("_")
    return parts[0] + "".join(part.capitalize() for part in parts[1:])


def extract_openai_text(response: dict) -> str:
    direct = response.get("output_text")
    if isinstance(direct, str) and direct.strip():
        return direct.strip()
    parts: list[str] = []
    for item in response.get("output", []) or []:
        for content in item.get("content", []) or []:
            text = content.get("text")
            if isinstance(text, str):
                parts.append(text)
    return "\n".join(parts).strip()


def call_summary_model(prompt: str, max_output_tokens: int = 3500) -> str:
    config = load_summary_config()
    api_key = config.get("api_key", "")
    model = config.get("model", "")
    provider = config.get("provider", "openai")
    if not api_key:
        raise RuntimeError(f"未配置 {provider} API Key。请设置环境变量，或在 asr-service/summary-config.json 中配置 apiKey。")
    if not model:
        raise RuntimeError(f"未配置 {provider} 总结模型。请在 asr-service/summary-config.json 中配置 model。")

    if config.get("api_type") == "responses":
        return call_responses_api(config, prompt, max_output_tokens)
    return call_chat_completions_api(config, prompt, max_output_tokens)


def call_responses_api(config: dict, prompt: str, max_output_tokens: int) -> str:
    base_url = config.get("base_url") or "https://api.openai.com/v1"
    model = config["model"]
    payload = {
        "model": model,
        "input": [
            {
                "role": "system",
                "content": (
                    "你是一个帮助学生复习网课的中文学习助理。"
                    "你必须基于字幕内容总结，不编造字幕中没有的信息。"
                    "输出要结构清晰、具体、可用于考前复习。"
                ),
            },
            {"role": "user", "content": prompt},
        ],
        "max_output_tokens": max_output_tokens,
    }
    body = _post_json(base_url.rstrip("/") + "/responses", config["api_key"], payload, timeout=SUMMARY_API_TIMEOUT)
    text = extract_openai_text(body)
    if not text:
        raise RuntimeError("模型接口未返回可用总结文本")
    return text


def call_chat_completions_api(config: dict, prompt: str, max_output_tokens: int) -> str:
    base_url = config.get("base_url", "").rstrip("/")
    if not base_url:
        raise RuntimeError("未配置 SUMMARY_BASE_URL")
    payload = {
        "model": config["model"],
        "messages": [
            {
                "role": "system",
                "content": (
                    "你是一个帮助学生复习网课的中文学习助理。"
                    "你必须基于字幕内容总结，不编造字幕中没有的信息。"
                    "输出要结构清晰、具体、可用于考前复习。"
                ),
            },
            {"role": "user", "content": prompt},
        ],
        "max_tokens": max_output_tokens,
    }
    urls = chat_completion_urls(base_url)
    errors: list[str] = []
    body: dict | None = None
    for url in urls:
        try:
            body = _post_json(url, config["api_key"], payload, timeout=SUMMARY_API_TIMEOUT)
            break
        except RuntimeError as exc:
            errors.append(f"{url}: {exc}")
    if body is None:
        raise RuntimeError("模型 API 请求失败。已尝试：\n" + "\n".join(errors[-3:]))
    choices = body.get("choices") or []
    if choices:
        message = choices[0].get("message") or {}
        content = message.get("content")
        if isinstance(content, str) and content.strip():
            return content.strip()
    raise RuntimeError("模型接口未返回可用总结文本")


def chat_completion_urls(base_url: str) -> list[str]:
    base = base_url.rstrip("/")
    if base.endswith("/chat/completions"):
        return [base]

    urls: list[str] = []
    # Most OpenAI-compatible relay endpoints expose /v1/chat/completions.
    should_try_v1 = (
        not base.endswith("/v1")
        and "/v1/" not in base
        and "/api/v3" not in base
        and "/compatible-mode/" not in base
    )
    if should_try_v1:
        urls.append(base + "/v1/chat/completions")
    urls.append(base + "/chat/completions")

    deduped: list[str] = []
    for url in urls:
        if url not in deduped:
            deduped.append(url)
    return deduped


def _post_json(url: str, api_key: str, payload: dict, timeout: int) -> dict:
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            text = response.read().decode("utf-8", errors="replace")
            try:
                return json.loads(text)
            except json.JSONDecodeError as exc:
                preview = text[:300].strip() or "<empty response>"
                raise RuntimeError(
                    "模型服务返回的不是 JSON。请检查 Base URL 是否需要 /v1，或中转站是否支持 OpenAI-compatible 接口。"
                    f" 响应预览：{preview}"
                ) from exc
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"模型 API 请求失败：HTTP {exc.code} {detail[:500]}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"无法连接模型 API：{exc.reason}") from exc
    except (TimeoutError, socket.timeout) as exc:
        raise RuntimeError(
            f"模型响应超时（已等待 {timeout} 秒）。豆包免费模型在长字幕总结时可能较慢，请稍后重试，"
            "或换用更快的模型/减少字幕长度。"
        ) from exc


def format_transcript(subtitles: list[dict]) -> str:
    lines: list[str] = []
    for item in subtitles:
        text = str(item.get("text", "")).strip()
        if not text:
            continue
        start = float(item.get("start", 0) or 0)
        mm = int(start // 60)
        ss = int(start % 60)
        lines.append(f"[{mm:02d}:{ss:02d}] {text}")
    return "\n".join(lines)


def build_summary_prompt(video_name: str, transcript: str, subtitle_count: int) -> str:
    return f"""请根据下面的视频字幕，生成一份适合学生快速复习的详细中文总结。

视频名称：{video_name or "当前视频"}
字幕数量：{subtitle_count}

要求：
1. 先给出“整体结论”，用 3-6 句话说明这个视频主要讲什么、核心价值是什么。
2. 给出“知识框架”，按主题分层组织，不要只摘抄原句。
3. 给出“重点详解”，解释关键概念、步骤、因果关系、例子和注意点。
4. 给出“时间线速览”，按字幕时间点列出每段内容，方便回看。
5. 给出“必须记住的要点”，用复习清单形式输出。
6. 给出“可能的考试/复习问题”，至少 5 个。
7. 如果字幕有口语重复、识别错误，请自动整理成通顺的学习笔记。

字幕如下：
{transcript}
"""


def summarize_with_openai(video_name: str, subtitles: list[dict]) -> str:
    transcript = format_transcript(subtitles)
    if not transcript:
        raise RuntimeError("没有可总结的字幕文本")

    max_chars = int(os.getenv("OPENAI_SUMMARY_CHUNK_CHARS", "12000"))
    if len(transcript) <= max_chars:
        return call_summary_model(build_summary_prompt(video_name, transcript, len(subtitles)))

    chunks = [transcript[i : i + max_chars] for i in range(0, len(transcript), max_chars)]
    partials: list[str] = []
    for idx, chunk in enumerate(chunks, 1):
        partial_prompt = f"""这是一个长视频字幕的第 {idx}/{len(chunks)} 段。
请只总结这一段，保留关键时间点、概念、例子和结论，输出中文学习笔记。

字幕片段：
{chunk}
"""
        partials.append(call_summary_model(partial_prompt, max_output_tokens=2200))

    merged = "\n\n".join(f"## 第 {idx} 段初步总结\n{part}" for idx, part in enumerate(partials, 1))
    final_prompt = f"""下面是同一个视频各字幕片段的初步总结。请合并成一份完整、去重、结构清晰的中文复习总结。

视频名称：{video_name or "当前视频"}

输出结构：
1. 整体结论
2. 知识框架
3. 重点详解
4. 时间线速览
5. 必须记住的要点
6. 可能的考试/复习问题

片段总结：
{merged}
"""
    return call_summary_model(final_prompt, max_output_tokens=4200)


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
        if path == "/api/summary-config":
            _json_response(self, 200, public_summary_config())
            return
        if path != "/api/health":
            _json_response(self, 404, {"detail": "not found"})
            return
        app_path = resolve_asrtools_app()
        ffmpeg = resolve_ffmpeg()
        summary_config = load_summary_config()
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
                "summary_provider": summary_config.get("provider"),
                "summary_model": summary_config.get("model"),
                "summary_configured": bool(summary_config.get("api_key") and summary_config.get("model")),
                "summary_api_timeout": SUMMARY_API_TIMEOUT,
            },
        )

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/summary-config":
            self._handle_summary_config()
            return
        if path == "/api/summarize":
            self._handle_summarize()
            return
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

    def _handle_summarize(self) -> None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
            data = json.loads(self.rfile.read(length).decode("utf-8"))
            subtitles = data.get("subtitles") or []
            if not isinstance(subtitles, list) or not subtitles:
                _json_response(self, 400, {"detail": "没有收到字幕内容"})
                return
            video_name = str(data.get("videoName") or "")
            summary = summarize_with_openai(video_name, subtitles)
            summary_config = load_summary_config()
            _json_response(
                self,
                200,
                {
                    "provider": summary_config.get("provider"),
                    "model": summary_config.get("model"),
                    "summary": summary,
                },
            )
        except Exception as exc:
            _json_response(self, 500, {"detail": str(exc)})

    def _handle_summary_config(self) -> None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
            data = json.loads(self.rfile.read(length).decode("utf-8"))
            saved = save_summary_config(data)
            _json_response(self, 200, saved)
        except Exception as exc:
            _json_response(self, 400, {"detail": str(exc)})

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
