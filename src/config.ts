import dotenv from 'dotenv';

dotenv.config();

export const config = {
  openaiApiKey: process.env.OPENAI_API_KEY,
  chatModel: process.env.CHAT_MODEL || 'gpt-4o-mini',
  embeddingsModel: process.env.EMBEDDINGS_MODEL || 'text-embedding-3-small',
  chunkSize: Number(process.env.CHUNK_SIZE) || 1000,
  chunkOverlap: Number(process.env.CHUNK_OVERLAP) || 200,
  topK: Number(process.env.TOP_K) || 5,
  maxTokens: Number(process.env.MAX_TOKENS) || 500,
  temprature: Number(process.env.TEMPERATURE) || 0.1,
  dataPath: process.env.DATA_PATH || './data',
  vectorStorePath: './storage/vectorstore.faiss',
  chromadb: {
    host: process.env.CHROMADB_HOST || 'localhost',
    port: Number(process.env.CHROMADB_PORT) || 8000,
    collectionName:
      process.env.CHROMADB_COLLECTION_NAME || 'zonneplan_knowledge_base',
  },
};
