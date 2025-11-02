// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import chatRoute from './routes/chatRoute.js';

dotenv.config();

const app = express();

// --- Allow list for prod (exact domains you deploy from) ---
const ENV_ORIGINS = [
  process.env.NETLIFY_ORIGIN,   // e.g. https://your-site.netlify.app
  process.env.FRONTEND_ORIGIN,  // e.g. https://app.yourdomain.com
].filter(Boolean);

// Accept any localhost / 127.0.0.1 (any port, http or https)
const isLocalhostOrigin = (origin) => {
  try {
    const { protocol, hostname } = new URL(origin);
    const isHttp = protocol === 'http:' || protocol === 'https:';
    const isLocal =
      hostname === 'localhost' ||
      hostname === '127.0.0.1';
    return isHttp && isLocal;
  } catch {
    // No Origin header (curl/Postman) => allow
    return true;
  }
};

// --- CORS FIRST (handles preflight automatically in Express 5) ---
// --- CORS FIRST ---
app.use(cors({
  origin: true,          // reflect the request's Origin automatically
  credentials: false,    // keep false (you’re not using cookies)
  methods: ['GET', 'POST', 'OPTIONS'],
  optionsSuccessStatus: 204,
}));


// Do NOT add app.options('*', ...) on Express 5 — global cors() handles it.

app.use(express.json({ limit: '2mb' }));

app.get('/health', (_, res) => res.send('ok'));

app.use('/api', chatRoute);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log('CORS prod origins:', ENV_ORIGINS.length ? ENV_ORIGINS : '(none)');
});
