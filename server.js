const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';
const CONTENT_PATH = path.join(__dirname, 'data', 'content.json');
const CHAT_LOG_PATH = path.join(__dirname, 'data', 'chat-leads.json');
const APPLICATIONS_PATH = path.join(__dirname, 'data', 'applications.json');
const STAFF_REQUESTS_PATH = path.join(__dirname, 'data', 'staff-requests.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

const tokens = new Set();
const chatSessions = new Map();

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

const readBody = (req) => new Promise((resolve) => {
  let data = '';
  req.on('data', (c) => { data += c; });
  req.on('end', () => {
    try { resolve(data ? JSON.parse(data) : {}); }
    catch { resolve(null); }
  });
});

const send = (res, code, payload, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*' });
  res.end(type.includes('json') ? JSON.stringify(payload) : payload);
};

const appendJsonFile = (filePath, entry) => {
  const existing = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : [];
  existing.push(entry);
  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2));
};

const readContent = () => JSON.parse(fs.readFileSync(CONTENT_PATH, 'utf8'));

const detectIntent = (text) => {
  if (/(job|nursing|position|apply|career)/.test(text)) return 'candidate';
  if (/(staff|hire|urgent|coverage|facility)/.test(text)) return 'employer';
  if (/(credential|compliance|license|onboard)/.test(text)) return 'credentialing';
  return 'general';
};

const qualificationPrompts = {
  name: 'May I have your full name?',
  email: 'Please share your email so our team can follow up.',
  role: 'What role are you hiring/applying for?',
  location: 'Which state or city is this for?',
  urgency: 'How urgent is this need? (e.g. immediate, this week, this month)'
};

const botReply = (message = '', content, sessionId) => {
  const text = String(message).toLowerCase();
  const session = chatSessions.get(sessionId) || { intent: null, step: 0, data: {} };

  if (!session.intent) {
    session.intent = detectIntent(text);
    session.step = 0;

    if (session.intent === 'candidate') {
      session.data.initialMessage = message;
      chatSessions.set(sessionId, session);
      return { reply: `Great! I can help with jobs. ${qualificationPrompts.name}`, done: false };
    }

    if (session.intent === 'employer') {
      session.data.initialMessage = message;
      chatSessions.set(sessionId, session);
      return { reply: `Absolutely—we support urgent staffing. ${qualificationPrompts.name}`, done: false };
    }

    if (session.intent === 'credentialing') {
      return { reply: 'Our workforce technology team supports credential tracking, onboarding, and compliance workflows. Would you like a specialist to contact you?', done: true };
    }

    return { reply: `Thanks for reaching out. A coordinator can follow up at ${content.chat.offlineEmail}.`, done: true };
  }

  const flow = ['name', 'email', 'role', 'location', 'urgency'];
  const currentField = flow[session.step];
  if (currentField) {
    session.data[currentField] = message;
    session.step += 1;
    const nextField = flow[session.step];

    if (nextField) {
      chatSessions.set(sessionId, session);
      return { reply: qualificationPrompts[nextField], done: false };
    }

    const handoff = session.intent === 'employer'
      ? `Thank you. Our staffing desk will contact you shortly at ${session.data.email || content.chat.offlineEmail}.`
      : `Perfect. A recruiter will contact you at ${session.data.email || content.chat.offlineEmail} with matching openings.`;

    return {
      reply: handoff,
      done: true,
      lead: {
        intent: session.intent,
        ...session.data
      }
    };
  }

  return { reply: `A coordinator can follow up at ${content.chat.offlineEmail}.`, done: true };
};

const serveFile = (res, filePath) => {
  if (!fs.existsSync(filePath)) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
  const ext = path.extname(filePath);
  send(res, 200, fs.readFileSync(filePath), mime[ext] || 'application/octet-stream');
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, '', 'text/plain; charset=utf-8');

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/content' && req.method === 'GET') {
    return send(res, 200, readContent());
  }

  if (url.pathname === '/api/chat' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body || typeof body.message !== 'string' || !body.message.trim()) {
      return send(res, 400, { error: 'Message is required' });
    }

    const content = readContent();
    const sessionId = String(body.sessionId || 'default');
    const result = botReply(body.message, content, sessionId);

    appendJsonFile(CHAT_LOG_PATH, {
      at: new Date().toISOString(),
      sessionId,
      message: body.message,
      reply: result.reply,
      lead: result.lead || null
    });

    if (result.done) chatSessions.delete(sessionId);
    else chatSessions.set(sessionId, chatSessions.get(sessionId));

    return send(res, 200, { reply: result.reply, done: result.done });
  }

  if (url.pathname === '/api/apply' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body || !body.name || !body.email || !body.jobId) {
      return send(res, 400, { error: 'name, email and jobId are required' });
    }
    appendJsonFile(APPLICATIONS_PATH, { at: new Date().toISOString(), ...body });
    return send(res, 200, { success: true, message: 'Application submitted successfully.' });
  }

  if (url.pathname === '/api/request-talent' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body || !body.facility || !body.contactName || !body.email) {
      return send(res, 400, { error: 'facility, contactName, and email are required' });
    }
    appendJsonFile(STAFF_REQUESTS_PATH, { at: new Date().toISOString(), ...body });
    return send(res, 200, { success: true, message: 'Staffing request submitted.' });
  }

  if (url.pathname === '/api/admin/login' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body || body.password !== ADMIN_PASSWORD) return send(res, 401, { error: 'Invalid password' });
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    tokens.add(token);
    return send(res, 200, { token });
  }

  if (url.pathname === '/api/admin/content' && req.method === 'PUT') {
    const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
    if (!tokens.has(token)) return send(res, 401, { error: 'Unauthorized' });
    const body = await readBody(req);
    if (!body || typeof body !== 'object') return send(res, 400, { error: 'Invalid payload' });
    fs.writeFileSync(CONTENT_PATH, JSON.stringify(body, null, 2));
    return send(res, 200, { success: true });
  }

  if (url.pathname === '/admin') return serveFile(res, path.join(PUBLIC_DIR, 'admin.html'));

  const staticPath = path.join(PUBLIC_DIR, decodeURIComponent(url.pathname));
  if (staticPath.startsWith(PUBLIC_DIR) && fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
    return serveFile(res, staticPath);
  }

  return serveFile(res, path.join(PUBLIC_DIR, 'index.html'));
});

server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
