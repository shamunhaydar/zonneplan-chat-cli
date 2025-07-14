import { readFile as readFileAsync, writeFile } from 'node:fs/promises';
import { Chroma } from '@langchain/community/vectorstores/chroma';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Document } from 'langchain/document';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { config } from '../config.js';
import { loadDocuments } from '../processors/document-processor.js';
import { ensureStorageDirectory } from '../utils/storage.js';

async function createChromaVectorStore(
  embeddings: OpenAIEmbeddings
): Promise<Chroma | null> {
  try {
    console.log('[INGEST] 🔌 Attempting to connect to ChromaDB...');

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

async function createFallbackMemoryStore(
  documents: Document[],
  embeddings: OpenAIEmbeddings
): Promise<MemoryVectorStore> {
  await ensureStorageDirectory();

  const fallbackStartTime = Date.now();
  console.log(
    '[INGEST] 🏗️ [OPTIMIZED] Building Memory vector store with batch processing...'
  );

  const vectorStore = await MemoryVectorStore.fromDocuments(
    documents,
    embeddings
  );

  const fallbackEndTime = Date.now();
  const fallbackTime = ((fallbackEndTime - fallbackStartTime) / 1000).toFixed(
    2
  );

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

    const CONCURRENCY_LIMIT = 10;
    const CHROMADB_BATCH_SIZE = 100;
    const totalBatches = Math.ceil(documents.length / CHROMADB_BATCH_SIZE);

    console.log(
      `[INGEST] 🔢 Processing ${documents.length} documents in ${totalBatches} batches of ${CHROMADB_BATCH_SIZE}`
    );
    console.log(
      `[INGEST] ⚡ Running with a concurrency limit of ${CONCURRENCY_LIMIT} parallel batches.`
    );

    const documentBatches = [];
    for (let i = 0; i < documents.length; i += CHROMADB_BATCH_SIZE) {
      const batch = documents.slice(i, i + CHROMADB_BATCH_SIZE);
      documentBatches.push(batch);
    }

    for (let i = 0; i < totalBatches; i += CONCURRENCY_LIMIT) {
      const concurrentBatches = documentBatches.slice(i, i + CONCURRENCY_LIMIT);
      const startBatchNum = i + 1;
      const endBatchNum = Math.min(i + CONCURRENCY_LIMIT, totalBatches);

      console.log(
        `[INGEST] 🚀 Processing batches ${startBatchNum} to ${endBatchNum} in parallel...`
      );

      const promises = concurrentBatches.map((batch, index) =>
        chromaStore.addDocuments(batch).catch((error) => {
          console.error(
            `[INGEST] ❌ Batch ${startBatchNum + index} failed during parallel execution:`,
            error
          );
          return { error: true, batchNumber: startBatchNum + index };
        })
      );

      await Promise.all(promises);

      console.log(
        `[INGEST] ✅ Completed parallel processing for batches ${startBatchNum} to ${endBatchNum}.`
      );
    }

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
    batchSize: 500,
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
