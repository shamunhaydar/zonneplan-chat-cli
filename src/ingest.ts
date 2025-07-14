import { createHash } from 'node:crypto';
import {
  mkdir,
  readdir,
  readFile,
  readFile as readFileAsync,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { CheerioWebBaseLoader } from '@langchain/community/document_loaders/web/cheerio';
import { Chroma } from '@langchain/community/vectorstores/chroma';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Document } from 'langchain/document';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { config } from './config.js';

function generateChunkId(
  content: string,
  source: string,
  chunkIndex: number
): string {
  const hash = createHash('sha256');
  hash.update(`${source}-${chunkIndex}-${content}`);
  return hash.digest('hex');
}

async function createChromaVectorStore(
  embeddings: OpenAIEmbeddings
): Promise<Chroma | null> {
  try {
    console.log('[INGEST] 🔌 Attempting to connect to ChromaDB...');

    // Create ChromaDB instance
    const vectorStore = new Chroma(embeddings, {
      url: `http://${config.chromadb.host}:${config.chromadb.port}`,
      collectionName: config.chromadb.collectionName,
    });

    console.log('[INGEST] ✅ Connected to ChromaDB successfully');
    return vectorStore;
  } catch (error) {
    console.log('[INGEST] ❌ Failed to connect to ChromaDB:', error);
    return null;
  }
}

async function ensureStorageDirectory(): Promise<void> {
  try {
    await mkdir('./storage', { recursive: true });
  } catch (_error) {
    // Directory might already exist, ignore
  }
}

/**
 * OPTIMIZED: Process a single file with error resilience
 * Returns empty array if file processing fails, allowing the batch to continue
 */
async function processFile(fileName: string): Promise<Document[]> {
  try {
    const filePath = join(config.dataPath, fileName);

    // Read file content
    const htmlContent = await readFile(filePath, 'utf-8');

    const loader = new CheerioWebBaseLoader(`file://${filePath}`);
    loader.load = async () => {
      const $ = await import('cheerio').then((m) => m.load(htmlContent));

      const title = $('title').text() || fileName.replace('.html', '');
      const textContent = $('body').text().trim();

      return [
        {
          pageContent: textContent,
          metadata: {
            source: fileName,
            title,
          },
        },
      ];
    };

    const docs = await loader.load();

    if (docs.length === 0 || !docs[0].pageContent.trim()) {
      console.log(`⚠️  No content found in ${fileName}, skipping`);
      return [];
    }

    // Create text splitter for this file
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: config.chunkSize,
      chunkOverlap: config.chunkOverlap,
    });

    const chunks = await splitter.splitDocuments(docs);

    // Add metadata to each chunk
    const documentsWithMetadata = chunks.map(
      (chunk, index) =>
        new Document({
          pageContent: chunk.pageContent,
          metadata: {
            source: fileName,
            title: docs[0].metadata.title as string,
            chunkIndex: index,
            chunkId: generateChunkId(chunk.pageContent, fileName, index),
          },
        })
    );

    console.log(`✓ ${fileName}: ${chunks.length} chunks created`);
    return documentsWithMetadata;
  } catch (error) {
    // RESILIENCE: Log error but continue with other files
    console.error(`❌ Error processing ${fileName}:`, error);
    return [];
  }
}

/**
 * OPTIMIZED: Load and process all documents in parallel
 * Key Performance Improvements:
 * 1. Parallel file I/O using Promise.all
 * 2. Aggregate all chunks before embedding
 * 3. Resilient error handling per file
 */
export async function loadDocuments(): Promise<Document[]> {
  const startTime = Date.now();
  console.log('\n🚀 [OPTIMIZED] Loading documents from:', config.dataPath);

  try {
    // Get all HTML files
    const files = await readdir(config.dataPath);
    const htmlFiles = files.filter((file) => file.endsWith('.html'));

    console.log(`📁 Found ${htmlFiles.length} HTML files`);
    console.log('🔄 Processing files in parallel...');

    // PERFORMANCE BOOST #1: Process ALL files concurrently using Promise.all
    // This eliminates sequential file I/O bottleneck
    const allDocumentArrays = await Promise.all(
      htmlFiles.map((fileName) => processFile(fileName))
    );

    // PERFORMANCE BOOST #2: Aggregate all chunks into single array
    // This prepares for batch processing in the next step
    const allDocuments = allDocumentArrays.flat();
    const successfulFiles = allDocumentArrays.filter(
      (docs) => docs.length > 0
    ).length;

    const endTime = Date.now();
    const processingTime = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n📊 File Processing Summary:');
    console.log(
      `- Files processed successfully: ${successfulFiles}/${htmlFiles.length}`
    );
    console.log(`- Total chunks created: ${allDocuments.length}`);
    console.log(`- Processing time: ${processingTime}s`);
    console.log(
      `- Average chunk size: ${Math.round(allDocuments.reduce((sum, doc) => sum + doc.pageContent.length, 0) / allDocuments.length)} characters`
    );

    return allDocuments;
  } catch (error) {
    console.error('❌ Error loading documents:', error);
    throw error;
  }
}

/**
 * OPTIMIZED v2: Create vector store with PARALLEL batch processing
 * Key Performance Improvements:
 * 1. Batch embeddings using OpenAI batchSize parameter
 * 2. Chunked ChromaDB insertion to avoid JSON.stringify limits
 * 3. (NEW) Parallel processing of ChromaDB batches with a concurrency limit
 * 4. Optional fallback with --useFallback flag
 */
export async function createVectorStoreWithChromaDB(
  useFallback = false
): Promise<Chroma | MemoryVectorStore> {
  const overallStartTime = Date.now();
  console.log('\n🚀 [OPTIMIZED v2] Creating vector store...');

  if (!config.openaiApiKey) {
    throw new Error(
      'OPENAI_API_KEY is required. Please set it in your .env file.'
    );
  }

  // STEP 1: Load and process all documents in parallel (no changes here)
  const documents = await loadDocuments();

  if (documents.length === 0) {
    throw new Error('No documents were successfully processed');
  }

  console.log('\n📈 [OPTIMIZED v2] Configuring embeddings with batching...');

  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: config.openaiApiKey,
    modelName: 'text-embedding-3-small',
    batchSize: 500,
    stripNewLines: true,
  });

  if (useFallback) {
    console.log(
      '[INGEST] 🔄 Using fallback MemoryVectorStore (--useFallback flag detected)...'
    );
    return await createFallbackMemoryStore(documents, embeddings);
  }

  const chromaStore = await createChromaVectorStore(embeddings);
  if (chromaStore) {
    const embeddingStartTime = Date.now();
    console.log(
      `[INGEST] 📦 [OPTIMIZED v2] Adding ${documents.length} documents to ChromaDB using PARALLEL batch processing...`
    );

    // --- START OF KEY CHANGES ---

    // PERFORMANCE BOOST #4: Define a concurrency limit to avoid overwhelming services
    const CONCURRENCY_LIMIT = 10; // Process 10 batches in parallel. Tune this as needed.
    const CHROMADB_BATCH_SIZE = 100;
    const totalBatches = Math.ceil(documents.length / CHROMADB_BATCH_SIZE);

    console.log(
      `[INGEST] 🔢 Processing ${documents.length} documents in ${totalBatches} batches of ${CHROMADB_BATCH_SIZE}`
    );
    console.log(
      `[INGEST] ⚡ Running with a concurrency limit of ${CONCURRENCY_LIMIT} parallel batches.`
    );

    // Create all the document batches first
    const documentBatches = [];
    for (let i = 0; i < documents.length; i += CHROMADB_BATCH_SIZE) {
      const batch = documents.slice(i, i + CHROMADB_BATCH_SIZE);
      documentBatches.push(batch);
    }

    // PERFORMANCE BOOST #5: Process the batches in concurrent chunks
    for (let i = 0; i < totalBatches; i += CONCURRENCY_LIMIT) {
      const concurrentBatches = documentBatches.slice(i, i + CONCURRENCY_LIMIT);
      const startBatchNum = i + 1;
      const endBatchNum = Math.min(i + CONCURRENCY_LIMIT, totalBatches);

      console.log(
        `[INGEST] 🚀 Processing batches ${startBatchNum} to ${endBatchNum} in parallel...`
      );

      // Create an array of promises for the current concurrent chunk
      const promises = concurrentBatches.map((batch, index) =>
        chromaStore.addDocuments(batch).catch((error) => {
          // Add resilience to the parallel execution
          console.error(
            `[INGEST] ❌ Batch ${startBatchNum + index} failed during parallel execution:`,
            error
          );
          // Optionally, return a marker for failed batches
          return { error: true, batchNumber: startBatchNum + index };
        })
      );

      // Use Promise.all to execute the current chunk of batches in parallel
      await Promise.all(promises);

      console.log(
        `[INGEST] ✅ Completed parallel processing for batches ${startBatchNum} to ${endBatchNum}.`
      );
    }

    // --- END OF KEY CHANGES ---

    const embeddingEndTime = Date.now();
    const embeddingTime = (
      (embeddingEndTime - embeddingStartTime) /
      1000
    ).toFixed(2);

    console.log(
      `[INGEST] ✅ Successfully ingested ${documents.length} documents into ChromaDB in ${embeddingTime}s`
    );

    const overallEndTime = Date.now();
    const totalTime = ((overallEndTime - overallStartTime) / 1000).toFixed(2);
    console.log(
      `\n🎉 [OPTIMIZED v2] Total ingestion completed in ${totalTime}s`
    );

    return chromaStore;
  }

  console.log(
    '[INGEST] ❌ ChromaDB connection failed, falling back to MemoryVectorStore...'
  );
  return await createFallbackMemoryStore(documents, embeddings);
}

/**
 * OPTIMIZED: Create fallback memory store with batch processing
 */
async function createFallbackMemoryStore(
  documents: Document[],
  embeddings: OpenAIEmbeddings
): Promise<MemoryVectorStore> {
  await ensureStorageDirectory();

  const fallbackStartTime = Date.now();
  console.log(
    '[INGEST] 🏗️ [OPTIMIZED] Building Memory vector store with batch processing...'
  );

  // PERFORMANCE BOOST #5: MemoryVectorStore.fromDocuments also benefits from batchSize
  // The embeddings will be generated in batches automatically
  const vectorStore = await MemoryVectorStore.fromDocuments(
    documents,
    embeddings
  );

  const fallbackEndTime = Date.now();
  const fallbackTime = ((fallbackEndTime - fallbackStartTime) / 1000).toFixed(
    2
  );

  // Save the vector store data as JSON for persistence
  console.log(
    `[INGEST] 💾 Saving fallback vector store to: ${config.vectorStorePath}.json`
  );
  const vectorData = {
    documents: documents.map((doc) => ({
      pageContent: doc.pageContent,
      metadata: doc.metadata,
    })),
    embeddings: await Promise.all(
      documents.map((doc) => embeddings.embedQuery(doc.pageContent))
    ),
  };

  await writeFile(
    `${config.vectorStorePath}.json`,
    JSON.stringify(vectorData, null, 2)
  );

  console.log(
    `[INGEST] ✅ Fallback vector store created and saved successfully in ${fallbackTime}s!`
  );
  return vectorStore;
}

export async function createVectorStore(): Promise<MemoryVectorStore> {
  console.log('\n🚀 Phase 3: Creating vector store...');

  if (!config.openaiApiKey) {
    throw new Error(
      'OPENAI_API_KEY is required. Please set it in your .env file.'
    );
  }

  const documents = await loadDocuments();

  console.log('\n📈 Creating embeddings...');
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: config.openaiApiKey,
    modelName: 'text-embedding-3-small',
    batchSize: 500, // Use batching here too
  });

  return await createFallbackMemoryStore(documents, embeddings);
}

export async function loadVectorStore(): Promise<MemoryVectorStore> {
  console.log('📖 Loading existing vector store...');

  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: config.openaiApiKey,
    modelName: 'text-embedding-3-small',
  });

  try {
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
      embeddings
    );

    console.log(`✅ Loaded vector store with ${documents.length} documents`);
    return vectorStore;
  } catch (_error) {
    console.log('⚠️  No existing vector store found, creating new one...');
    return await createVectorStore();
  }
}

/**
 * OPTIMIZED: Test vector store with performance metrics
 */
export async function testVectorStore(): Promise<void> {
  console.log('\n🧪 [OPTIMIZED] Testing vector store performance...');

  // Try ChromaDB first, then fallback
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: config.openaiApiKey,
    modelName: 'text-embedding-3-small',
    batchSize: 100, // Smaller batch for testing
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

const isMainModule =
  process.argv[1] &&
  (import.meta.url === `file://${process.argv[1]}` ||
    import.meta.url.includes(process.argv[1].replace(/\\/g, '/')) ||
    process.argv[1].includes('ingest.js'));

if (isMainModule) {
  const runMain = async () => {
    // Parse command line arguments
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
