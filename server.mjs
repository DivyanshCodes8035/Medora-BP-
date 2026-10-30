import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const HOST = '127.0.0.1';
const MAX_BODY = 16_000;
const SYSTEM_PROMPT = `You are Medora BP Guide, a patient-education assistant for a classroom prototype about home blood pressure tracking. Be warm, clear, concise, and encourage users to discuss personal readings and care with a licensed clinician. Explain general concepts and help prepare questions. Never diagnose, claim to detect disease, set an individual's target, recommend starting/stopping/changing a medicine or dose, or replace emergency care. For missed doses, advise checking the medication leaflet or asking a pharmacist/clinician; never advise doubling. If the user describes a reading over 180 systolic and/or 120 diastolic, tell them to wait at least one minute and repeat it. If it remains that high with chest pain, shortness of breath, weakness, numbness, vision changes, difficulty speaking, or another severe new symptom, tell them to call their local emergency number now. If it remains that high without symptoms, tell them to contact a healthcare professional immediately. The Medora app's saved journal is not shared with you; use only the information the user includes in this chat. Do not ask for names, addresses, or other identifying information. This is general information, not medical advice.`;

async function loadEnv() {
  try {
    const raw = await readFile(path.join(ROOT, '.env'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (match && !Object.hasOwn(process.env, match[1])) process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2');
    }
  } catch { /* .env is optional */ }
}

function providerConfig() {
  const provider = (process.env.MEDORA_PROVIDER || 'gemini').toLowerCase();
  if (provider === 'groq') return {
    provider: 'Groq', model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
    key: process.env.GROQ_API_KEY, url: 'https://api.groq.com/openai/v1/chat/completions'
  };
  return {
    provider: 'Gemini', model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    key: process.env.GEMINI_API_KEY,
    url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(process.env.GEMINI_MODEL || 'gemini-3.8-flash')}:generateContent`
  };
}

function send(res, status, data, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(type.startsWith('application/json') ? JSON.stringify(data) : data);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > MAX_BODY) { reject(new Error('large')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { reject(new Error('invalid')); }
    });
    req.on('error', reject);
  });
}

async function answerWithProvider(messages) {
  const cfg = providerConfig();
  if (!cfg.key) throw new Error('not-configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    let url, headers, body;
    if (cfg.provider === 'Groq') {
      url = cfg.url;
      headers = { Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' };
      body = { model: cfg.model, temperature: 0.4, max_completion_tokens: 600,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages] };
    } else {
      url = `${cfg.url}?key=${encodeURIComponent(cfg.key)}`;
      headers = { 'Content-Type': 'application/json' };
      body = { systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: { temperature: 0.4, maxOutputTokens: 600 } };
    }
    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
    if (!response.ok) throw new Error('provider-failed');
    const result = await response.json();
    const reply = cfg.provider === 'Groq'
      ? result.choices?.[0]?.message?.content
      : result.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('');
    if (typeof reply !== 'string' || !reply.trim()) throw new Error('provider-failed');
    return reply.trim();
  } finally { clearTimeout(timer); }
}

const publicFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/assets/dna-bg.png', ['assets/dna-bg.png', 'image/png']],
  ['/assets/dna-small.png', ['assets/dna-small.png', 'image/png']],
  ['/assets/images/dna-bg.png', ['../assets/images/dna-bg.png', 'image/png']],
  ['/assets/images/dna-small.png', ['../assets/images/dna-small.png', 'image/png']]
]);

await loadEnv();
const PORT = Number(process.env.PORT || 4173);
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  if (req.method === 'GET' && url.pathname === '/api/status') {
    const cfg = providerConfig();
    return send(res, 200, { connected: Boolean(cfg.key), provider: cfg.provider, model: cfg.model });
  }
  if (req.method === 'POST' && url.pathname === '/api/chat') {
    try {
      const payload = await readJson(req);
      if (!Array.isArray(payload.messages) || payload.messages.length < 1 || payload.messages.length > 10) return send(res, 400, { error: 'Please send a short chat.' });
      const messages = payload.messages.map(item => {
        if (!item || !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string' || !item.content.trim() || item.content.length > 1000) throw new Error('invalid');
        return { role: item.role, content: item.content.trim() };
      });
      if (messages.at(-1).role !== 'user') return send(res, 400, { error: 'A user question is required.' });
      const cfg = providerConfig();
      if (!cfg.key) return send(res, 503, { error: 'AI is not configured.' });
      const last = messages.at(-1).content;
      if (/\b(emergency|chest pain|shortness of breath|can't breathe|weakness|numbness|vision changes?|difficulty speaking|stroke|180\s*\/\s*120)\b/i.test(last)) {
        return send(res, 200, { reply: 'If a reading is over 180 systolic and/or 120 diastolic, wait at least 1 minute and repeat it. If it stays that high and you have chest pain, shortness of breath, weakness, numbness, vision changes, difficulty speaking, or another severe new symptom, call your local emergency number now. If it stays very high without symptoms, contact a healthcare professional immediately. Do not wait for this chat.' });
      }
      return send(res, 200, { reply: await answerWithProvider(messages) });
    } catch (error) {
      const status = error.message === 'large' ? 413 : error.message === 'invalid' ? 400 : 502;
      return send(res, status, { error: 'The BP Guide could not get a response. Please try again or contact a healthcare professional for personal care.' });
    }
  }
  if (req.method === 'GET' && publicFiles.has(url.pathname)) {
    const [relative, type] = publicFiles.get(url.pathname);
    const filePath = relative.startsWith('../') ? path.join(ROOT, relative) : path.join(ROOT, relative);
    try { return send(res, 200, await readFile(filePath), type); }
    catch { return send(res, 404, 'Not found', 'text/plain; charset=utf-8'); }
  }
  return send(res, 404, { error: 'Not found.' });
});

server.listen(PORT, HOST, () => console.log(`Medora BP Notes available at http://${HOST}:${PORT}/`));
