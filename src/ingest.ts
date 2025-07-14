import { testVectorStore } from './testing/vector-store-test.js';
import { createVectorStoreWithChromaDB } from './vector-store/vector-store.js';

export { loadDocuments } from './processors/document-processor.js';

export { testVectorStore } from './testing/vector-store-test.js';
// Re-export main functions for backward compatibility
export {
  createVectorStore,
  createVectorStoreWithChromaDB,
  loadVectorStore,
} from './vector-store/vector-store.js';

const isMainModule =
  process.argv[1] &&
  (import.meta.url === `file://${process.argv[1]}` ||
    import.meta.url.includes(process.argv[1].replace(/\\/g, '/')) ||
    process.argv[1].includes('ingest.js'));

if (isMainModule) {
  const runMain = async () => {
    const args = process.argv.slice(2);
    const useFallback =
      args.includes('--useFallback') || args.includes('--use-fallback');

    if (useFallback) {
      console.log('🔄 --useFallback flag detected, skipping ChromaDB...');
    }

    console.log('🚀 Starting OPTIMIZED ingestion pipeline...');
    console.log('⚡ Performance improvements:');
    console.log('  1. Parallel file processing with Promise.all');
    console.log('  2. Batch embeddings (500 chunks per API call)');
    console.log('  3. Chunked ChromaDB insertion (avoids JSON limits)');
    console.log('  4. Resilient error handling');
    console.log('  5. Performance metrics and timing');
    console.log('  6. Optional --useFallback flag for MemoryVectorStore\n');

    await createVectorStoreWithChromaDB(useFallback);
    await testVectorStore();
  };

  runMain().catch((error) => {
    console.error('❌ Optimized vector store creation failed:', error);
    console.log('\n💡 Troubleshooting tips:');
    console.log(
      '  - Use --useFallback flag to skip ChromaDB and use MemoryVectorStore'
    );
    console.log(
      '  - Ensure ChromaDB is running: docker run -p 8000:8000 chromadb/chroma'
    );
    console.log('  - Check your OpenAI API key is set in .env file');
    process.exit(1);
  });
}
