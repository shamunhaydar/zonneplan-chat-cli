import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CheerioWebBaseLoader } from '@langchain/community/document_loaders/web/cheerio';
import { Document } from 'langchain/document';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { config } from '../config.js';
import { generateChunkId } from '../utils/crypto.js';

async function processFile(fileName: string): Promise<Document[]> {
  try {
    const filePath = join(config.dataPath, fileName);
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
  } catch (error) {
    console.error(`❌ Error processing ${fileName}:`, error);
    return [];
  }
}

export async function loadDocuments(): Promise<Document[]> {
  const startTime = Date.now();
  console.log('\n🚀 [OPTIMIZED] Loading documents from:', config.dataPath);

  try {
    const files = await readdir(config.dataPath);
    const htmlFiles = files.filter((file) => file.endsWith('.html'));

    console.log(`📁 Found ${htmlFiles.length} HTML files`);
    console.log('🔄 Processing files in parallel...');

    const allDocumentArrays = await Promise.all(
      htmlFiles.map((fileName) => processFile(fileName))
    );

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
