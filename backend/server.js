// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import chatRoute from './routes/chatRoute.js';

dotenv.config();

const app = express();

const FRONTEND_ORIGINS = [
  process.env.NETLIFY_ORIGIN,                 // e.g. https://your-site.netlify.app
  process.env.FRONTEND_ORIGIN,                // optional extra
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean); // drop undefined

const isAllowedOrigin = (origin) => {
  if (!origin) return true; // curl/postman etc.
  // allow exact matches or any *.netlify.app if you prefer
  if (FRONTEND_ORIGINS.includes(origin)) return true;
  if (/\.netlify\.app$/.test(new URL(origin).hostname)) return true;
  return false;
};

app.use(cors({
  origin: (origin, cb) => {
    if (isAllowedOrigin(origin)) cb(null, true);
    else {
      console.warn('❌ Blocked by CORS:', origin);
      cb(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET','POST','OPTIONS'],
}));

app.use(express.json({ limit: '2mb' }));

app.get('/health', (_, res) => res.send('ok'));

app.use('/api', chatRoute);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
