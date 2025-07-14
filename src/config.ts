import dotenv from 'dotenv';

dotenv.config();

export const config = {
  openaiApiKey: process.env.OPENAI_API_KEY,
  chunkSize: 1000,
  chunkOverlap: 200,
  topK: 5,
  dataPath: './data',
  vectorStorePath: './storage/vectorstore.faiss'
};