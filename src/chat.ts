import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { Document } from "langchain/document";
import { readFile as readFileAsync } from 'fs/promises';
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
      throw new Error('OPENAI_API_KEY is required. Please set it in your .env file.');
    }

    this.llm = new ChatOpenAI({
      openAIApiKey: config.openaiApiKey,
      modelName: "gpt-4o-mini",
      temperature: 0.1,
      maxTokens: 500,
    });

    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: config.openaiApiKey,
      modelName: "text-embedding-3-small",
    });
  }

  async loadVectorStore(): Promise<void> {
    console.log('📖 Loading vector store...');
    
    try {
      const vectorData = JSON.parse(await readFileAsync(`${config.vectorStorePath}.json`, 'utf-8'));
      
      const documents = vectorData.documents.map((doc: any) => new Document({
        pageContent: doc.pageContent,
        metadata: doc.metadata
      }));
      
      this.vectorStore = await MemoryVectorStore.fromDocuments(documents, this.embeddings);
      console.log(`✅ Vector store loaded with ${documents.length} documents`);
      
    } catch (error) {
      throw new Error(`Failed to load vector store: ${error}. Please run 'pnpm ingest' first.`);
    }
  }

  async retrieveRelevantDocuments(query: string, topK: number = config.topK): Promise<Document[]> {
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
        answer: "Ik kan deze vraag niet beantwoorden op basis van de beschikbare informatie. Probeer een andere vraag over zonnepanelen, energie of financiering.",
        sources: [],
        foundRelevantInfo: false
      };
    }

    // Prepare context from retrieved documents
    const context = relevantDocs
      .map((doc, index) => `[${index + 1}] ${doc.pageContent}`)
      .join('\n\n');

    const sources = [...new Set(relevantDocs.map(doc => doc.metadata.source))];

    console.log(`📄 Found ${relevantDocs.length} relevant chunks from ${sources.length} sources`);

    try {
      const prompt = this.createPrompt(context, query);
      const response = await this.llm.invoke(prompt);

      return {
        answer: response.content.toString().trim(),
        sources,
        foundRelevantInfo: true
      };

    } catch (error) {
      console.error('Error generating answer:', error);
      return {
        answer: "Sorry, er is een fout opgetreden bij het verwerken van je vraag. Probeer het later nog eens.",
        sources: [],
        foundRelevantInfo: false
      };
    }
  }

  async testRAGPipeline(): Promise<void> {
    console.log('\n🧪 Testing RAG Pipeline...');
    
    const testQueries = [
      "Wat is saldering bij zonnepanelen?",
      "Hoe werkt de terugleververgoeding?",
      "Kan ik een lening krijgen voor zonnepanelen?",
      "Wat kost een elektriciteitsauto?", // Should return "not found"
    ];

    for (const query of testQueries) {
      console.log(`\n❓ Query: "${query}"`);
      const response = await this.generateAnswer(query);
      
      console.log(`💬 Answer: ${response.answer}`);
      
      if (response.foundRelevantInfo) {
        console.log(`📚 Sources: ${response.sources.join(', ')}`);
      } else {
        console.log(`📚 No relevant sources found`);
      }
    }
  }
}

// Environment variable setup helper
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

// Test the RAG pipeline when run directly
const isMainModule = process.argv[1] && (
  import.meta.url === `file://${process.argv[1]}` || 
  import.meta.url.includes(process.argv[1].replace(/\\/g, '/')) ||
  process.argv[1].includes('chat.js')
);

if (isMainModule) {
  const runTest = async () => {
    await setupEnvironment();
    
    const chatbot = new RAGChatbot();
    await chatbot.loadVectorStore();
    await chatbot.testRAGPipeline();
    
    console.log(`\n🎉 Phase 4 RAG Pipeline completed successfully!`);
    console.log(`Ready for Phase 5: CLI Integration`);
  };
  
  runTest().catch(error => {
    console.error('❌ RAG Pipeline test failed:', error);
    process.exit(1);
  });
}