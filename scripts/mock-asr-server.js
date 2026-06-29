const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const sampleSrt = `1
00:00:00,000 --> 00:00:03,000
这是 mock ASR 生成的第一条字幕

2
00:00:03,000 --> 00:00:06,000
如果你能看到这两条字幕，说明前端生成链路已打通
`;

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/字幕播放器.html';
  const filePath = path.resolve(root, urlPath.replace(/^\/+/, ''));
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}

function sendJson(res, body) {
  res.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(body));
}

const staticServer = http.createServer(serveStatic);

const asrServer = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, {});
    return;
  }
  if (req.url.startsWith('/api/health')) {
    sendJson(res, {
      ok: true,
      videocaptioner: true,
      videocaptioner_command: 'mock',
      ffmpeg: true,
      ffmpeg_command: 'mock',
    });
    return;
  }
  if (req.url.startsWith('/api/transcribe') && req.method === 'POST') {
    req.resume();
    req.on('end', () => {
      sendJson(res, {
        filename: 'mock-video.mp4',
        provider: 'mock',
        engine: 'mock',
        format: 'srt',
        srt: sampleSrt,
      });
    });
    return;
  }
  res.writeHead(404, { 'Access-Control-Allow-Origin': '*' });
  res.end('Not found');
});

staticServer.on('error', (err) => {
  console.error('Static server failed:', err.message);
});

asrServer.on('error', (err) => {
  console.error('Mock ASR server failed:', err.message);
});

staticServer.listen(18088, '127.0.0.1', () => {
  console.log('Static server: http://127.0.0.1:18088');
});

asrServer.listen(28765, '127.0.0.1', () => {
  console.log('Mock ASR server: http://127.0.0.1:28765');
});
