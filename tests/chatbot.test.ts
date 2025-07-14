import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RAGChatbot } from '../src/chat.js';
import { Document } from 'langchain/document';

// Mock external dependencies completely
vi.mock('@langchain/openai');
vi.mock('@langchain/community/vectorstores/chroma');
vi.mock('langchain/vectorstores/memory');
vi.mock('node:fs/promises');

// Mock config
vi.mock('../src/config.js', () => ({
  config: {
    openaiApiKey: 'test-api-key',
    chatModel: 'gpt-4o-mini',
    embeddingsModel: 'text-embedding-3-small',
    topK: 5,
    maxTokens: 500,
    temprature: 0.1,
    vectorStorePath: './storage/vectorstore.faiss',
    chromadb: {
      host: 'localhost',
      port: 8000,
      collectionName: 'test_collection',
    },
  },
}));

describe('RAGChatbot Core Functionality', () => {
  let chatbot: RAGChatbot;
  let mockVectorStore: any;
  let mockLLM: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create comprehensive mocks
    mockLLM = {
      invoke: vi.fn(),
    };

    mockVectorStore = {
      similaritySearch: vi.fn(),
    };

    chatbot = new RAGChatbot();
    // Override internals for testing
    (chatbot as any).vectorStore = mockVectorStore;
    (chatbot as any).llm = mockLLM;
  });

  describe('Document Retrieval', () => {
    it('should retrieve documents from vector store', async () => {
      const mockDocs = [
        new Document({
          pageContent: 'Solar panels generate electricity',
          metadata: { source: 'test1.html' },
        }),
      ];

      mockVectorStore.similaritySearch.mockResolvedValue(mockDocs);

      const result = await chatbot.retrieveRelevantDocuments('solar panels');

      expect(mockVectorStore.similaritySearch).toHaveBeenCalledWith('solar panels', 5);
      expect(result).toEqual(mockDocs);
    });

    it('should throw error when vector store not loaded', async () => {
      const emptyBot = new RAGChatbot();
      // Don't set vector store

      await expect(
        emptyBot.retrieveRelevantDocuments('test query')
      ).rejects.toThrow('Vector store not loaded. Call loadVectorStore() first.');
    });

    it('should respect custom topK parameter', async () => {
      mockVectorStore.similaritySearch.mockResolvedValue([]);

      await chatbot.retrieveRelevantDocuments('test', 3);

      expect(mockVectorStore.similaritySearch).toHaveBeenCalledWith('test', 3);
    });
  });

  describe('Answer Generation Pipeline', () => {
    it('should return not found when no documents retrieved', async () => {
      mockVectorStore.similaritySearch.mockResolvedValue([]);

      const result = await chatbot.generateAnswer('irrelevant query');

      expect(result).toEqual({
        answer: 'Ik kan deze vraag niet beantwoorden op basis van de beschikbare informatie. Probeer een andere vraag over zonnepanelen, energie of financiering.',
        sources: [],
        foundRelevantInfo: false,
      });
      expect(mockLLM.invoke).not.toHaveBeenCalled();
    });

    it('should process documents and generate answer', async () => {
      const mockDocs = [
        new Document({
          pageContent: 'Zonnepanelen produceren duurzame energie',
          metadata: { source: 'solar.html' },
        }),
      ];

      mockVectorStore.similaritySearch.mockResolvedValue(mockDocs);
      mockLLM.invoke.mockResolvedValue({
        content: 'Ja, zonnepanelen zijn een uitstekende bron van hernieuwbare energie.',
      });

      const result = await chatbot.generateAnswer('Zijn zonnepanelen duurzaam?');

      expect(result.answer).toBe('Ja, zonnepanelen zijn een uitstekende bron van hernieuwbare energie.');
      expect(result.sources).toEqual(['solar.html']);
      expect(result.foundRelevantInfo).toBe(true);
    });

    it('should handle multiple documents and deduplicate sources', async () => {
      const mockDocs = [
        new Document({
          pageContent: 'Info 1',
          metadata: { source: 'doc1.html' },
        }),
        new Document({
          pageContent: 'Info 2',
          metadata: { source: 'doc1.html' }, // Duplicate source
        }),
        new Document({
          pageContent: 'Info 3',
          metadata: { source: 'doc2.html' },
        }),
      ];

      mockVectorStore.similaritySearch.mockResolvedValue(mockDocs);
      mockLLM.invoke.mockResolvedValue({ content: 'Combined answer' });

      const result = await chatbot.generateAnswer('test');

      expect(result.sources).toEqual(['doc1.html', 'doc2.html']);
      expect(result.sources).toHaveLength(2);
    });

    it('should handle LLM failures gracefully', async () => {
      const mockDocs = [
        new Document({
          pageContent: 'Some content',
          metadata: { source: 'test.html' },
        }),
      ];

      mockVectorStore.similaritySearch.mockResolvedValue(mockDocs);
      mockLLM.invoke.mockRejectedValue(new Error('LLM API Error'));

      const result = await chatbot.generateAnswer('test query');

      expect(result.answer).toBe('Sorry, er is een fout opgetreden bij het verwerken van je vraag. Probeer het later nog eens.');
      expect(result.sources).toEqual([]);
      expect(result.foundRelevantInfo).toBe(false);
    });
  });

  describe('Vector Store Info', () => {
    it('should return FAISS info by default', () => {
      const info = chatbot.getVectorStoreInfo();

      expect(info).toEqual({
        type: 'FAISS (MemoryVectorStore)',
        isConnected: true,
      });
    });

    it('should return ChromaDB info when using Chroma', () => {
      (chatbot as any).usingChroma = true;

      const info = chatbot.getVectorStoreInfo();

      expect(info).toEqual({
        type: 'ChromaDB',
        isConnected: true,
      });
    });

    it('should indicate disconnected when no vector store', () => {
      (chatbot as any).vectorStore = null;

      const info = chatbot.getVectorStoreInfo();

      expect(info.isConnected).toBe(false);
    });
  });

  describe('Prompt Construction', () => {
    it('should verify prompt structure without executing LLM', async () => {
      const mockDocs = [
        new Document({
          pageContent: 'Test content for prompt',
          metadata: { source: 'test.html' },
        }),
      ];

      mockVectorStore.similaritySearch.mockResolvedValue(mockDocs);
      mockLLM.invoke.mockResolvedValue({ content: 'Mock response' });

      await chatbot.generateAnswer('test question');

      expect(mockLLM.invoke).toHaveBeenCalledTimes(1);
      const promptArg = mockLLM.invoke.mock.calls[0][0];
      
      // Verify key elements of Dutch prompt
      expect(promptArg).toContain('Je bent een behulpzame AI-assistent van Zonneplan');
      expect(promptArg).toContain('Gebruik ALLEEN de onderstaande context');
      expect(promptArg).toContain('Beantwoord in het Nederlands');
      expect(promptArg).toContain('Test content for prompt');
      expect(promptArg).toContain('test question');
    });

    it('should format context with numbered sections', async () => {
      const mockDocs = [
        new Document({
          pageContent: 'First chunk',
          metadata: { source: 'doc1.html' },
        }),
        new Document({
          pageContent: 'Second chunk',
          metadata: { source: 'doc2.html' },
        }),
      ];

      mockVectorStore.similaritySearch.mockResolvedValue(mockDocs);
      mockLLM.invoke.mockResolvedValue({ content: 'Mock response' });

      await chatbot.generateAnswer('test');

      const promptArg = mockLLM.invoke.mock.calls[0][0];
      expect(promptArg).toContain('[1] First chunk');
      expect(promptArg).toContain('[2] Second chunk');
    });
  });

  describe('Edge Cases', () => {
    it('should handle documents without metadata source', async () => {
      const mockDocs = [
        new Document({
          pageContent: 'Content without source',
          metadata: {},
        }),
      ];

      mockVectorStore.similaritySearch.mockResolvedValue(mockDocs);
      mockLLM.invoke.mockResolvedValue({ content: 'Response' });

      const result = await chatbot.generateAnswer('test');

      expect(result.sources).toEqual([undefined]);
    });

    it('should handle empty document content', async () => {
      const mockDocs = [
        new Document({
          pageContent: '',
          metadata: { source: 'empty.html' },
        }),
      ];

      mockVectorStore.similaritySearch.mockResolvedValue(mockDocs);
      mockLLM.invoke.mockResolvedValue({ content: 'Response' });

      const result = await chatbot.generateAnswer('test');

      expect(result.foundRelevantInfo).toBe(true);
      expect(result.sources).toEqual(['empty.html']);
    });
  });
});