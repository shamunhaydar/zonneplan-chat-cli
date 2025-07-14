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
  } catch (error) {
    // Directory might already exist, ignore
  }
}

export async function loadDocuments(): Promise<Document[]> {
  console.log('Loading documents from:', config.dataPath);

  try {
    const files = await readdir(config.dataPath);
    const htmlFiles = files.filter((file) => file.endsWith('.html'));

    console.log(`Found ${htmlFiles.length} HTML files`);

    const processFile = async (fileName: string): Promise<Document[]> => {
      try {
        const filePath = join(config.dataPath, fileName);
        console.log(`Processing: ${fileName}`);

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

        const splitter = new RecursiveCharacterTextSplitter({
          chunkSize: config.chunkSize,
          chunkOverlap: config.chunkOverlap,
        });

        const chunks = await splitter.splitDocuments(docs);

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
      } catch (_error) {
        console.error(`❌ Error processing ${fileName}:`, _error);
        return [];
      }
    };

    const allDocumentArrays = await Promise.all(
      htmlFiles.map((fileName) => processFile(fileName))
    );

    const allDocuments = allDocumentArrays.flat();
    const totalProcessed = allDocumentArrays.filter(
      (docs) => docs.length > 0
    ).length;

    console.log('\n📊 Summary:');
    console.log(`- Files processed: ${totalProcessed}/${htmlFiles.length}`);
    console.log(`- Total chunks: ${allDocuments.length}`);
    console.log(
      `- Average chunk size: ${Math.round(allDocuments.reduce((sum, doc) => sum + doc.pageContent.length, 0) / allDocuments.length)} characters`
    );

    return allDocuments;
  } catch (error) {
    console.error('Error loading documents:', error);
    throw error;
  }
}

export async function createVectorStoreWithChromaDB(): Promise<
  Chroma | MemoryVectorStore
> {
  console.log('\n🚀 Creating vector store with ChromaDB...');

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
  });

  // Try ChromaDB first
  const chromaStore = await createChromaVectorStore(embeddings);
  if (chromaStore) {
    console.log(
      '[INGEST] 📦 Adding documents to ChromaDB (with idempotency)...'
    );

    await chromaStore.addDocuments(documents);
    console.log(
      `[INGEST] ✅ Successfully ingested ${documents.length} documents into ChromaDB`
    );

    // Also create fallback JSON store
    await createFallbackMemoryStore(documents, embeddings);

    return chromaStore;
  }

  // Fallback to MemoryVectorStore
  console.log('[INGEST] 📦 Falling back to MemoryVectorStore...');
  return await createFallbackMemoryStore(documents, embeddings);
}

async function createFallbackMemoryStore(
  documents: Document[],
  embeddings: OpenAIEmbeddings
): Promise<MemoryVectorStore> {
  await ensureStorageDirectory();

  console.log('[INGEST] 🏗️ Building Memory vector store...');
  const vectorStore = await MemoryVectorStore.fromDocuments(
    documents,
    embeddings
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
    '[INGEST] ✅ Fallback vector store created and saved successfully!'
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

export async function testVectorStore(): Promise<void> {
  console.log('\n🧪 Testing vector store...');

  // Try ChromaDB first, then fallback
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: config.openaiApiKey,
    modelName: 'text-embedding-3-small',
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
  ];

  const searchResults = await Promise.all(
    testQueries.map(async (query) => {
      console.log(`\nQuery: "${query}"`);
      const results = await vectorStore.similaritySearch(query, 2);

      results.forEach((result, index) => {
        console.log(
          `  ${index + 1}. [${result.metadata.source}] ${result.pageContent.substring(0, 100)}...`
        );
      });

      return { query, results };
    })
  );

  console.log(`\n✅ Tested ${searchResults.length} queries successfully`);
}

const isMainModule =
  process.argv[1] &&
  (import.meta.url === `file://${process.argv[1]}` ||
    import.meta.url.includes(process.argv[1].replace(/\\/g, '/')) ||
    process.argv[1].includes('ingest.js'));

if (isMainModule) {
  const runMain = async () => {
    await createVectorStoreWithChromaDB();
    await testVectorStore();
  };

  runMain().catch((error) => {
    console.error('❌ Vector store creation failed:', error);
    process.exit(1);
  });
}
