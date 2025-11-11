import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import chatRoute from './routes/chatRoute.js';

dotenv.config();

const app = express();

app.use(cors({
  origin: true,
  credentials: false,
  methods: ['GET', 'POST', 'OPTIONS'],
  optionsSuccessStatus: 204,
}));

app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.send('ok'));
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.use('/api', chatRoute);

const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0'; // this line is crucial

app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on http://${HOST}:${PORT}`);
});
