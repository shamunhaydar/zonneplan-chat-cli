import { RAGChatbot } from '../src/chat.js';

const OPENAI_API_KEY_REGEX = /OPENAI_API_KEY=(.+)/;

async function setupEnvironment(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) {
    const { readFile } = await import('node:fs/promises');
    const envContent = await readFile('.env', 'utf-8').catch(() => '');
    const match = envContent.match(OPENAI_API_KEY_REGEX);
    if (match) {
      process.env.OPENAI_API_KEY = match[1].trim();
    }
  }
}

async function testRAGPipeline(): Promise<void> {
  console.log('\n🧪 Testing RAG Pipeline...');

  const testQueries = [
    'Wat is saldering bij zonnepanelen?',
    'Hoe werkt de terugleververgoeding?',
    'Kan ik een lening krijgen voor zonnepanelen?',
    'Wat kost een elektriciteitsauto?', // Should return "not found"
  ];

  const chatbot = new RAGChatbot();
  await chatbot.loadVectorStore();

  for (const query of testQueries) {
    console.log(`\n❓ Query: "${query}"`);
    const response = await chatbot.generateAnswer(query);

    console.log(`💬 Answer: ${response.answer}`);

    if (response.foundRelevantInfo) {
      console.log(`📚 Sources: ${response.sources.join(', ')}`);
    } else {
      console.log('📚 No relevant sources found');
    }
  }
}

async function main() {
  try {
    await setupEnvironment();
    await testRAGPipeline();
    console.log('\n✅ All tests completed successfully');
  } catch (error) {
    console.error('❌ RAG Pipeline test failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
