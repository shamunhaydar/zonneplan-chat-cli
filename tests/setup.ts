import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set up test environment variables
process.env.OPENAI_API_KEY = 'test-api-key';
process.env.CHAT_MODEL = 'gpt-4o-mini';
process.env.EMBEDDINGS_MODEL = 'text-embedding-3-small';
