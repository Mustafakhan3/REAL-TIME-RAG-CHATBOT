import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import chatRoute from './routes/chatRoute.js';  // Import the chatRoute using ES Module syntax

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Setup the routes for handling chat messages
app.use("/api", chatRoute);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
