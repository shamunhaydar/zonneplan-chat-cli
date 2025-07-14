import inquirer from 'inquirer';
import { RAGChatbot, ChatResponse } from './chat.js';

export class InteractiveChatbot {
  private chatbot: RAGChatbot;
  private conversationHistory: Array<{role: 'user' | 'assistant', content: string}> = [];

  constructor() {
    this.chatbot = new RAGChatbot();
  }

  async loadVectorStore(): Promise<void> {
    await this.chatbot.loadVectorStore();
  }

  async generateAnswer(query: string): Promise<ChatResponse> {
    const response = await this.chatbot.generateAnswer(query);
    
    // Add to conversation history
    this.conversationHistory.push({role: 'user', content: query});
    this.conversationHistory.push({role: 'assistant', content: response.answer});
    
    // Keep only last 10 messages to avoid context overload
    if (this.conversationHistory.length > 10) {
      this.conversationHistory = this.conversationHistory.slice(-10);
    }
    
    return response;
  }

  displayResponse(response: ChatResponse): void {
    console.log(`\n💬 ${response.answer}`);
    
    if (response.foundRelevantInfo && response.sources.length > 0) {
      console.log(`\n📚 Bronnen: ${response.sources.join(', ')}`);
    }
  }

  clearHistory(): void {
    this.conversationHistory = [];
    console.log('🗑️ Gesprekgeschiedenis gewist.');
  }

  displayHelp(): void {
    console.log(`
🤖 Zonneplan Chat Hulp

Beschikbare commando's:
• help    - Toon deze hulp
• clear   - Wis gesprekgeschiedenis  
• quit    - Stop de chat

Je kunt vragen stellen over:
• Zonnepanelen en saldering
• Terugleververgoeding
• Financiering en leningen
• Energie en duurzaamheid

Voorbeelden:
• "Wat is saldering bij zonnepanelen?"
• "Hoe werkt de terugleververgoeding?"
• "Kan ik een lening krijgen voor zonnepanelen?"
    `);
  }

  async start(): Promise<void> {
    console.log('🌞 Welkom bij Zonneplan Chat!');
    console.log('Typ "help" voor hulp of "quit" om te stoppen.\n');

    await this.loadVectorStore();

    while (true) {
      try {
        const { query } = await inquirer.prompt([
          {
            type: 'input',
            name: 'query',
            message: '💬 Jouw vraag:',
            validate: (input: string) => input.trim().length > 0 || 'Voer een vraag in'
          }
        ]);

        const trimmedQuery = query.trim().toLowerCase();

        if (trimmedQuery === 'quit' || trimmedQuery === 'exit') {
          console.log('\n👋 Tot ziens!');
          break;
        }

        if (trimmedQuery === 'help') {
          this.displayHelp();
          continue;
        }

        if (trimmedQuery === 'clear') {
          this.clearHistory();
          continue;
        }

        console.log('🔍 Bezig met zoeken...');
        const response = await this.generateAnswer(query);
        this.displayResponse(response);

      } catch (error) {
        console.error('\n❌ Er is een fout opgetreden:', error);
        console.log('Probeer het opnieuw of typ "quit" om te stoppen.');
      }
    }
  }
}

// Start the interactive chat when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runChat = async () => {
    const chatbot = new InteractiveChatbot();
    await chatbot.start();
  };

  runChat().catch(error => {
    console.error('❌ Chat failed to start:', error);
    process.exit(1);
  });
}