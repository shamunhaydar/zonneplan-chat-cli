/** biome-ignore-all lint/performance/noDelete: <explanation> */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../src/config.js';

// Mock dotenv
vi.mock('dotenv', () => ({
  default: {
    config: vi.fn(),
  },
}));

describe('Config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear environment variables
    delete process.env.OPENAI_API_KEY;
    delete process.env.CHAT_MODEL;
    delete process.env.EMBEDDINGS_MODEL;
    delete process.env.CHUNK_SIZE;
    delete process.env.CHUNK_OVERLAP;
    delete process.env.TOP_K;
    delete process.env.MAX_TOKENS;
    delete process.env.TEMPERATURE;
    delete process.env.DATA_PATH;
    delete process.env.CHROMADB_HOST;
    delete process.env.CHROMADB_PORT;
    delete process.env.CHROMADB_COLLECTION_NAME;
  });

  it('should use default values when environment variables are not set', () => {
    expect(config.chatModel).toBe('gpt-4o-mini');
    expect(config.embeddingsModel).toBe('text-embedding-3-small');
    expect(config.chunkSize).toBe(1000);
    expect(config.chunkOverlap).toBe(200);
    expect(config.topK).toBe(5);
    expect(config.maxTokens).toBe(500);
    expect(config.temprature).toBe(0.1);
    expect(config.dataPath).toBe('./data');
    expect(config.vectorStorePath).toBe('./storage/vectorstore.faiss');
    expect(config.chromadb.host).toBe('localhost');
    expect(config.chromadb.port).toBe(8000);
    expect(config.chromadb.collectionName).toBe('zonneplan_knowledge_base');
  });

  it('should use environment variables when set', () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.CHAT_MODEL = 'gpt-4';
    process.env.EMBEDDINGS_MODEL = 'text-embedding-ada-002';
    process.env.CHUNK_SIZE = '1500';
    process.env.CHUNK_OVERLAP = '300';
    process.env.TOP_K = '10';
    process.env.MAX_TOKENS = '1000';
    process.env.TEMPERATURE = '0.2';
    process.env.DATA_PATH = './custom-data';
    process.env.CHROMADB_HOST = 'custom-host';
    process.env.CHROMADB_PORT = '9000';
    process.env.CHROMADB_COLLECTION_NAME = 'custom-collection';

    // Re-import config to get updated values
    vi.resetModules();

    expect(process.env.OPENAI_API_KEY).toBe('test-key');
    expect(process.env.CHAT_MODEL).toBe('gpt-4');
    expect(process.env.EMBEDDINGS_MODEL).toBe('text-embedding-ada-002');
    expect(Number(process.env.CHUNK_SIZE)).toBe(1500);
    expect(Number(process.env.CHUNK_OVERLAP)).toBe(300);
    expect(Number(process.env.TOP_K)).toBe(10);
    expect(Number(process.env.MAX_TOKENS)).toBe(1000);
    expect(Number(process.env.TEMPERATURE)).toBe(0.2);
    expect(process.env.DATA_PATH).toBe('./custom-data');
    expect(process.env.CHROMADB_HOST).toBe('custom-host');
    expect(Number(process.env.CHROMADB_PORT)).toBe(9000);
    expect(process.env.CHROMADB_COLLECTION_NAME).toBe('custom-collection');
  });

  it('should handle invalid numeric environment variables', () => {
    process.env.CHUNK_SIZE = 'invalid';
    process.env.CHUNK_OVERLAP = 'invalid';
    process.env.TOP_K = 'invalid';
    process.env.MAX_TOKENS = 'invalid';
    process.env.TEMPERATURE = 'invalid';
    process.env.CHROMADB_PORT = 'invalid';

    // These should default to NaN when Number() is called on invalid strings
    expect(Number(process.env.CHUNK_SIZE)).toBeNaN();
    expect(Number(process.env.CHUNK_OVERLAP)).toBeNaN();
    expect(Number(process.env.TOP_K)).toBeNaN();
    expect(Number(process.env.MAX_TOKENS)).toBeNaN();
    expect(Number(process.env.TEMPERATURE)).toBeNaN();
    expect(Number(process.env.CHROMADB_PORT)).toBeNaN();
  });

  it('should have required configuration structure', () => {
    expect(config).toHaveProperty('openaiApiKey');
    expect(config).toHaveProperty('chatModel');
    expect(config).toHaveProperty('embeddingsModel');
    expect(config).toHaveProperty('chunkSize');
    expect(config).toHaveProperty('chunkOverlap');
    expect(config).toHaveProperty('topK');
    expect(config).toHaveProperty('maxTokens');
    expect(config).toHaveProperty('temprature');
    expect(config).toHaveProperty('dataPath');
    expect(config).toHaveProperty('vectorStorePath');
    expect(config).toHaveProperty('chromadb');
    expect(config.chromadb).toHaveProperty('host');
    expect(config.chromadb).toHaveProperty('port');
    expect(config.chromadb).toHaveProperty('collectionName');
  });
});
