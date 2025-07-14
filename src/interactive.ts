import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { Document } from "langchain/document";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatMessageHistory } from "langchain/memory";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import inquirer from 'inquirer';
import { readFile as readFileAsync } from 'fs/promises';
import { config } from './config.js';

interface ChatResponse {
  answer: string;
  sources: string[];
  foundRelevantInfo: boolean;
}

export class InteractiveChatbot {
  private vectorStore: MemoryVectorStore | null = null;
  private llm: ChatOpenAI;
  private embeddings: OpenAIEmbeddings;
  private messageHistory: ChatMessageHistory;

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

    this.messageHistory = new ChatMessageHistory();
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

  private createRAGPrompt(): PromptTemplate {
    const template = `Je bent een behulpzame AI-assistent van Zonneplan die vragen beantwoordt over zonnepanelen, energie en financiering.

Gebruik ALLEEN de onderstaande context om de vraag te beantwoorden. Als de informatie niet in de context staat, zeg dan eerlijk dat je het niet weet.

Context:
{context}

Gesprekgeschiedenis:
{chat_history}

Huidige vraag: {question}

Instructies:
- Beantwoord in het Nederlands
- Wees beknopt maar informatief
- Gebruik alleen informatie uit de gegeven context
- Verwijs naar bronnen als dat relevant is
- Houd rekening met eerdere vragen in het gesprek
- Als je het antwoord niet weet op basis van de context, zeg dan: "Ik kan deze vraag niet beantwoorden op basis van de beschikbare informatie."

Antwoord:`;

    return PromptTemplate.fromTemplate(template);
  }

  async generateAnswer(query: string): Promise<ChatResponse> {
    console.log(`🔍 Processing query: "${query}"`);
    
    // Retrieve relevant documents
    const relevantDocs = await this.retrieveRelevantDocuments(query);
    
    if (relevantDocs.length === 0) {
      const fallbackResponse = {
        answer: "Ik kan deze vraag niet beantwoorden op basis van de beschikbare informatie. Probeer een andere vraag over zonnepanelen, energie of financiering.",
        sources: [],
        foundRelevantInfo: false
      };
      
      // Add to chat history
      await this.messageHistory.addMessage(new HumanMessage(query));
      await this.messageHistory.addMessage(new AIMessage(fallbackResponse.answer));
      
      return fallbackResponse;
    }

    // Prepare context from retrieved documents
    const context = relevantDocs
      .map((doc, index) => `[${index + 1}] ${doc.pageContent}`)
      .join('\n\n');

    const sources = [...new Set(relevantDocs.map(doc => doc.metadata.source))];

    // Get chat history for context
    const messages = await this.messageHistory.getMessages();
    const chatHistory = messages
      .slice(-10) // Keep last 10 messages
      .map(msg => `${msg.constructor.name === 'HumanMessage' ? 'Gebruiker' : 'Assistent'}: ${msg.content}`)
      .join('\n');

    console.log(`📄 Found ${relevantDocs.length} relevant chunks from ${sources.length} sources`);

    // Create RAG chain
    const prompt = this.createRAGPrompt();
    const outputParser = new StringOutputParser();

    const ragChain = RunnableSequence.from([
      prompt,
      this.llm,
      outputParser,
    ]);

    try {
      const answer = await ragChain.invoke({
        context: context,
        question: query,
        chat_history: chatHistory,
      });

      const response = {
        answer: answer.trim(),
        sources,
        foundRelevantInfo: true
      };

      // Add to chat history
      await this.messageHistory.addMessage(new HumanMessage(query));
      await this.messageHistory.addMessage(new AIMessage(response.answer));

      return response;

    } catch (error) {
      console.error('Error generating answer:', error);
      const errorResponse = {
        answer: "Sorry, er is een fout opgetreden bij het verwerken van je vraag. Probeer het later nog eens.",
        sources: [],
        foundRelevantInfo: false
      };

      await this.messageHistory.addMessage(new HumanMessage(query));
      await this.messageHistory.addMessage(new AIMessage(errorResponse.answer));

      return errorResponse;
    }
  }

  async startInteractiveCLI(): Promise<void> {
    console.log('\n🤖 Welkom bij de Zonneplan AI Assistent!');
    console.log('💡 Stel vragen over zonnepanelen, energie en financiering.');
    console.log('⚡ Type "quit", "exit" of "stop" om te stoppen.');
    console.log('💭 Type "help" voor meer informatie.\n');

    while (true) {
      try {
        const { question } = await inquirer.prompt([
          {
            type: 'input',
            name: 'question',
            message: '❓ Jouw vraag:',
            validate: (input: string) => {
              if (!input.trim()) {
                return 'Voer een vraag in.';
              }
              return true;
            },
          },
        ]);

        const trimmedQuestion = question.trim();

        // Check for exit commands
        if (['quit', 'exit', 'stop', 'q'].includes(trimmedQuestion.toLowerCase())) {
          console.log('\n👋 Bedankt voor het gebruiken van de Zonneplan AI Assistent!');
          break;
        }

        // Special commands
        if (trimmedQuestion.toLowerCase() === 'help') {
          console.log('\n📚 Help:');
          console.log('- Stel vragen over zonnepanelen, saldering, terugleververgoeding');
          console.log('- Vraag naar financieringsmogelijkheden en leningen');
          console.log('- Type "quit", "exit" of "stop" om te stoppen');
          console.log('- Type "clear" om de gesprekgeschiedenis te wissen\n');
          continue;
        }

        if (trimmedQuestion.toLowerCase() === 'clear') {
          this.messageHistory = new ChatMessageHistory();
          console.log('🧹 Gesprekgeschiedenis gewist.\n');
          continue;
        }

        // Generate answer
        console.log('\n🔄 Bezig met verwerken...');
        const response = await this.generateAnswer(trimmedQuestion);

        // Display response
        console.log('\n💬 Antwoord:');
        console.log(`${response.answer}\n`);

        if (response.foundRelevantInfo && response.sources.length > 0) {
          console.log('📚 Bronnen:');
          response.sources.forEach((source, index) => {
            const displayName = source.replace('http_www.zonneplan.nl_kenniscentrum_', '').replace('.html', '');
            console.log(`   ${index + 1}. ${displayName}`);
          });
          console.log('');
        }

      } catch (error) {
        if (error && typeof error === 'object' && 'isTtyError' in error) {
          console.log('\n❌ Interactive mode not supported in this environment.');
          break;
        }
        console.error('\n❌ Er is een fout opgetreden:', error);
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

// Main CLI interface when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runCLI = async () => {
    await setupEnvironment();
    
    const chatbot = new InteractiveChatbot();
    await chatbot.loadVectorStore();
    await chatbot.startInteractiveCLI();
  };
  
  runCLI().catch(error => {
    console.error('❌ Chat application failed:', error);
    process.exit(1);
  });
}