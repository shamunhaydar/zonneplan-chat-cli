import { Chroma } from '@langchain/community/vectorstores/chroma';
import { OpenAIEmbeddings } from '@langchain/openai';
import type { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { config } from '../config.js';
import { loadVectorStore } from '../vector-store/vector-store.js';

async function createChromaVectorStore(
  embeddings: OpenAIEmbeddings
): Promise<Chroma | null> {
  try {
    console.log('[TEST] 🔌 Attempting to connect to ChromaDB...');

    const vectorStore = new Chroma(embeddings, {
      url: `http://${config.chromadb.host}:${config.chromadb.port}`,
      collectionName: config.chromadb.collectionName,
    });

    console.log('[TEST] ✅ Connected to ChromaDB successfully');
    return vectorStore;
  } catch (error) {
    console.log('[TEST] ❌ Failed to connect to ChromaDB:', error);
    return null;
  }
}

export async function testVectorStore(): Promise<void> {
  console.log('\n🧪 [OPTIMIZED] Testing vector store performance...');

  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: config.openaiApiKey,
    modelName: 'text-embedding-3-small',
    batchSize: 100,
  });

  let vectorStore: Chroma | MemoryVectorStore;

  const chromaStore = await createChromaVectorStore(embeddings);
  if (chromaStore) {
    console.log('[TEST] 🎯 Testing ChromaDB vector store...');
    vectorStore = chromaStore;
  } else {
    console.log('[TEST] 🎯 Testing fallback MemoryVectorStore...');
    vectorStore = await loadVectorStore();
  }

  const testQueries = [
    'wat is saldering?',
    'hoe werkt terugleververgoeding?',
    'zonnepanelen lening',
    'energiecontract opzeggen',
    'warmtepomp installatie',
  ];

  console.log(`[TEST] 🔍 Running ${testQueries.length} test queries...`);
  const testStartTime = Date.now();

  const searchResults = await Promise.all(
    testQueries.map(async (query, index) => {
      const queryStartTime = Date.now();
      console.log(`\n${index + 1}. Query: "${query}"`);
      const results = await vectorStore.similaritySearch(query, 3);
      const queryEndTime = Date.now();
      const queryTime = queryEndTime - queryStartTime;

      results.forEach((result, resultIndex) => {
        console.log(
          `   ${resultIndex + 1}. [${result.metadata.source}] ${result.pageContent.substring(0, 100)}...`
        );
      });

      console.log(`   ⏱️ Query time: ${queryTime}ms`);
      return { query, results, queryTime };
    })
  );

  const testEndTime = Date.now();
  const totalTestTime = testEndTime - testStartTime;
  const avgQueryTime = Math.round(totalTestTime / testQueries.length);

  console.log('\n📊 Test Performance Summary:');
  console.log(`- Total test time: ${totalTestTime}ms`);
  console.log(`- Average query time: ${avgQueryTime}ms`);
  console.log(`- Queries per second: ${(1000 / avgQueryTime).toFixed(2)}`);
  console.log(`✅ Tested ${searchResults.length} queries successfully`);
}
