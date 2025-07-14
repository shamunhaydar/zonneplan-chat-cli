import { readFile as readFileAsync } from 'node:fs/promises';
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
  private vectorStore: MemoryVectorStore | null = null;
  private llm: ChatOpenAI;
  private embeddings: OpenAIEmbeddings;

  constructor() {
    if (!config.openaiApiKey) {
      throw new Error(
        'OPENAI_API_KEY is required. Please set it in your .env file.'
      );
    }

    this.llm = new ChatOpenAI({
      openAIApiKey: config.openaiApiKey,
      modelName: 'gpt-4o-mini',
      temperature: 0.1,
      maxTokens: 500,
    });

    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: config.openaiApiKey,
      modelName: 'text-embedding-3-small',
    });
  }

  async loadVectorStore(): Promise<void> {
    console.log('📖 Loading vector store...');

    try {
      const vectorData = JSON.parse(
        await readFileAsync(`${config.vectorStorePath}.json`, 'utf-8')
      );

      const documents = vectorData.documents.map(
        (doc: any) =>
          new Document({
            pageContent: doc.pageContent,
            metadata: doc.metadata,
          })
      );

      this.vectorStore = await MemoryVectorStore.fromDocuments(
        documents,
        this.embeddings
      );
      console.log(`✅ Vector store loaded with ${documents.length} documents`);
    } catch (error) {
      throw new Error(
        `Failed to load vector store: ${error}. Please run 'pnpm ingest' first.`
      );
    }
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
    console.log(`🔍 Processing query: "${query}"`);

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
}

async function setupEnvironment(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) {
    const envContent = await readFileAsync('.env', 'utf-8').catch(() => '');
    const match = envContent.match(/OPENAI_API_KEY=(.+)/);
    if (match) {
      process.env.OPENAI_API_KEY = match[1].trim();
    }
  }
}

export async function startChat() {
  console.log('🤖 Starting RAG Chatbot...');

  await setupEnvironment();

  const chatbot = new RAGChatbot();
  await chatbot.loadVectorStore();

  return chatbot;
}
