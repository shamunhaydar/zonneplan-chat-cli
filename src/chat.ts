import { readFile as readFileAsync } from 'node:fs/promises';
import { Chroma } from '@langchain/community/vectorstores/chroma';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { Document } from 'langchain/document';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { config } from './config.js';

export interface ChatResponse {
  answer: string;
  sources: string[];
  foundRelevantInfo: boolean;
}

export class RAGChatbot {
  private vectorStore: MemoryVectorStore | Chroma | null = null;
  private llm: ChatOpenAI;
  private embeddings: OpenAIEmbeddings;
  private usingChroma = false;

  constructor() {
    if (!config.openaiApiKey) {
      throw new Error(
        'OPENAI_API_KEY is required. Please set it in your .env file.'
      );
    }

    this.llm = new ChatOpenAI({
      openAIApiKey: config.openaiApiKey,
      modelName: config.chatModel,
      temperature: config.temprature,
      maxTokens: config.maxTokens,
    });

    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: config.openaiApiKey,
      modelName: config.embeddingsModel,
    });
  }

  private async tryConnectToChromaDB(): Promise<Chroma | null> {
    try {
      console.log('[CHAT] 🔌 Attempting to connect to ChromaDB...');
      const vectorStore = new Chroma(this.embeddings, {
        url: `http://${config.chromadb.host}:${config.chromadb.port}`,
        collectionName: config.chromadb.collectionName,
      });

      // Test the connection by trying to query
      await vectorStore.similaritySearch('test', 1);
      console.log(
        '[CHAT] ✅ Connected to ChromaDB. Using ChromaDB for retrieval.'
      );
      return vectorStore;
    } catch (error) {
      console.log(
        '[CHAT] ❌ Failed to connect to ChromaDB:',
        (error as Error).message
      );
      return null;
    }
  }

  private async loadFallbackMemoryStore(): Promise<MemoryVectorStore | null> {
    try {
      console.log(
        "[CHAT] 📖 Attempting to load FAISS from 'vectorstore.faiss.json'..."
      );

      const vectorData = JSON.parse(
        await readFileAsync(`${config.vectorStorePath}.json`, 'utf-8')
      );

      const documents = vectorData.documents.map(
        (doc: { pageContent: string; metadata: Record<string, unknown> }) =>
          new Document({
            pageContent: doc.pageContent,
            metadata: doc.metadata,
          })
      );

      const vectorStore = await MemoryVectorStore.fromDocuments(
        documents,
        this.embeddings
      );
      console.log(
        '[CHAT] ✅ Successfully loaded FAISS from disk. Using FAISS for retrieval.'
      );
      console.log(`[CHAT] 📊 Loaded ${documents.length} documents from FAISS`);
      return vectorStore;
    } catch (_error) {
      console.log(
        `[CHAT] ❌ Could not connect to ChromaDB and 'vectorstore.faiss.json' not found. Knowledge base unavailable. Please run ingestion first.`
      );
      return null;
    }
  }

  async loadVectorStore(): Promise<void> {
    // Try ChromaDB first
    const chromaStore = await this.tryConnectToChromaDB();
    if (chromaStore) {
      this.vectorStore = chromaStore;
      this.usingChroma = true;
      return;
    }

    // Fallback to MemoryVectorStore from JSON
    const memoryStore = await this.loadFallbackMemoryStore();
    if (memoryStore) {
      this.vectorStore = memoryStore;
      this.usingChroma = false;
      return;
    }

    throw new Error(
      "No vector store available. Please ensure ChromaDB is running or run 'pnpm ingest' to create a local fallback."
    );
  }

  async retrieveRelevantDocuments(
    query: string,
    topK: number = config.topK
  ): Promise<Document[]> {
    if (!this.vectorStore) {
      throw new Error('Vector store not loaded. Call loadVectorStore() first.');
    }

    const results = await this.vectorStore.similaritySearch(query, topK);
    return results;
  }

  private createPrompt(context: string, question: string): string {
    return `Je bent een behulpzame AI-assistent van Zonneplan die vragen beantwoordt over zonnepanelen, energie en financiering.

Gebruik ALLEEN de onderstaande context om de vraag te beantwoorden. Als de informatie niet in de context staat, zeg dan eerlijk dat je het niet weet.

Context:
${context}

Vraag: ${question}

Instructies:
- Beantwoord in het Nederlands
- Wees beknopt maar informatief
- Gebruik alleen informatie uit de gegeven context
- Verwijs naar bronnen als dat relevant is
- Als je het antwoord niet weet op basis van de context, zeg dan: "Ik kan deze vraag niet beantwoorden op basis van de beschikbare informatie."

Antwoord:`;
  }

  async generateAnswer(query: string): Promise<ChatResponse> {
    const storeType = this.usingChroma ? 'ChromaDB' : 'FAISS';
    console.log(`🔍 Processing query: "${query}" using ${storeType}`);

    // Retrieve relevant documents
    const relevantDocs = await this.retrieveRelevantDocuments(query);

    if (relevantDocs.length === 0) {
      return {
        answer:
          'Ik kan deze vraag niet beantwoorden op basis van de beschikbare informatie. Probeer een andere vraag over zonnepanelen, energie of financiering.',
        sources: [],
        foundRelevantInfo: false,
      };
    }

    // Prepare context from retrieved documents
    const context = relevantDocs
      .map((doc, index) => `[${index + 1}] ${doc.pageContent}`)
      .join('\n\n');

    const sources = [
      ...new Set(relevantDocs.map((doc) => doc.metadata.source)),
    ];

    console.log(
      `📄 Found ${relevantDocs.length} relevant chunks from ${sources.length} sources`
    );

    try {
      const prompt = this.createPrompt(context, query);
      const response = await this.llm.invoke(prompt);

      return {
        answer: response.content.toString().trim(),
        sources,
        foundRelevantInfo: true,
      };
    } catch (error) {
      console.error('Error generating answer:', error);
      return {
        answer:
          'Sorry, er is een fout opgetreden bij het verwerken van je vraag. Probeer het later nog eens.',
        sources: [],
        foundRelevantInfo: false,
      };
    }
  }

  getVectorStoreInfo(): { type: string; isConnected: boolean } {
    return {
      type: this.usingChroma ? 'ChromaDB' : 'FAISS (MemoryVectorStore)',
      isConnected: this.vectorStore !== null,
    };
  }
}

export async function startChat() {
  console.log('🤖 Starting RAG Chatbot...');

  const chatbot = new RAGChatbot();
  await chatbot.loadVectorStore();

  const info = chatbot.getVectorStoreInfo();
  console.log(
    `📊 Vector store info: ${info.type}, Connected: ${info.isConnected}`
  );

  return chatbot;
}
