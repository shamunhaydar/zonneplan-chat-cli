import { RAGChatbot } from '../src/chat.js';

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

  const results = await Promise.all(
    testQueries.map(async (query) => {
      console.log(`\n❓ Query: "${query}"`);
      const response = await chatbot.generateAnswer(query);

      console.log(`💬 Answer: ${response.answer}`);

      if (response.foundRelevantInfo) {
        console.log(`📚 Sources: ${response.sources.join(', ')}`);
      } else {
        console.log('📚 No relevant sources found');
      }

      return { query, response };
    })
  );

  console.log(`\n✅ Completed ${results.length} test queries`);
}

async function main() {
  try {
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
