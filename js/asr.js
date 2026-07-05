window.DP = window.DP || {};

// ==================== ASR 字幕生成 ====================

DP.ASR_ENDPOINT_KEY = 'dp_asr_endpoint';
DP.ASR_ENGINE_KEY = 'dp_asr_engine';
DP.DEFAULT_ASR_ENDPOINT = 'http://127.0.0.1:28888/api/transcribe';
DP.DEFAULT_ASR_ENGINE = 'bijian';

DP.getAsrEndpoint = function getAsrEndpoint() {
  try {
    const stored = localStorage.getItem(DP.ASR_ENDPOINT_KEY);
    if (stored && !stored.includes(':8765/') && !stored.includes(':18765/') && !stored.includes(':28765/') && !stored.includes(':28768/') && !stored.includes(':28778/') && !stored.includes(':28788/')) {
      return stored;
    }
    if (stored) {
      localStorage.setItem(DP.ASR_ENDPOINT_KEY, DP.DEFAULT_ASR_ENDPOINT);
    }
    return DP.DEFAULT_ASR_ENDPOINT;
  } catch(e) {
    return DP.DEFAULT_ASR_ENDPOINT;
  }
};

DP.getAsrEngine = function getAsrEngine() {
  try {
    return localStorage.getItem(DP.ASR_ENGINE_KEY) || DP.DEFAULT_ASR_ENGINE;
  } catch(e) {
    return DP.DEFAULT_ASR_ENGINE;
  }
};

DP.setGenerateButtonBusy = function setGenerateButtonBusy(isBusy, text) {
  if (!DP.btnGenerateSub) return;
  DP.btnGenerateSub.disabled = isBusy;
  DP.btnGenerateSub.textContent = text || (isBusy ? '🎙 生成中...' : '🎙 生成字幕');
};

DP.fetchWithTimeout = async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, Object.assign({}, options || {}, { signal: controller.signal }));
  } finally {
    clearTimeout(timer);
  }
};

DP.checkAsrService = async function checkAsrService(endpoint) {
  const healthUrl = endpoint.replace(/\/api\/transcribe(?:\?.*)?$/, '/api/health');
  let resp;
  try {
    resp = await DP.fetchWithTimeout(healthUrl, { method: 'GET' }, 5000);
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('连接 ASR 服务超时，请确认服务已启动并重启到最新代码');
    }
    throw new Error('无法连接 ASR 服务，请先启动 asr-service');
  }
  if (!resp.ok) {
    throw new Error('ASR 服务健康检查失败：HTTP ' + resp.status);
  }
  const health = await resp.json();
  if (!health.ok) {
    throw new Error('ASR 服务未就绪');
  }
  if (!health.videocaptioner && !health.asrtools && DP.getAsrEngine() !== 'whisper-api') {
    throw new Error('ASR 服务已启动，但未检测到可用的 AsrTools/VideoCaptioner');
  }
  return health;
};

DP.generateSubtitlesForCurrentVideo = async function generateSubtitlesForCurrentVideo() {
  if (!DP.currentVideoFile) {
    DP.showToast('⚠ 请先打开本地视频文件');
    return;
  }

  const endpoint = DP.getAsrEndpoint();
  const engine = DP.getAsrEngine();
  const form = new FormData();
  form.append('file', DP.currentVideoFile, DP.currentVideoFile.name);
  form.append('engine', engine);
  form.append('language', 'zh');
  form.append('format', 'srt');

  DP.setGenerateButtonBusy(true);
  DP.showToast('🎙 正在生成字幕，长视频需要等待一会儿');

  try {
    await DP.checkAsrService(endpoint);

    const resp = await DP.fetchWithTimeout(endpoint, {
      method: 'POST',
      body: form,
    }, 60 * 60 * 1000);

    let data = null;
    const contentType = resp.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await resp.json();
    } else {
      data = { srt: await resp.text() };
    }

    if (!resp.ok) {
      throw new Error(data.detail || data.error || ('ASR 服务返回 HTTP ' + resp.status));
    }

    const srt = data.srt || data.text || '';
    if (!srt.trim()) {
      throw new Error('ASR 服务没有返回字幕内容');
    }

    const subtitleName = (DP.currentVideoName || DP.currentVideoFile.name).replace(/\.[^.]+$/, '') + '.generated.srt';
    DP.loadSubtitlesFromText(srt, subtitleName);
    DP.showToast('✅ 字幕生成完成');
  } catch (err) {
    console.error('ASR failed:', err);
    const message = err.name === 'AbortError'
      ? '连接 ASR 服务超时，请确认 asr-service 已启动'
      : (err.message || err);
    DP.showToast('⚠ 字幕生成失败：' + message);
  } finally {
    DP.setGenerateButtonBusy(false);
  }
};

if (DP.btnGenerateSub) {
  DP.btnGenerateSub.addEventListener('click', DP.generateSubtitlesForCurrentVideo);
}
