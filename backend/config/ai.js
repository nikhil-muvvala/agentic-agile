import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

export const aiClient = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});
