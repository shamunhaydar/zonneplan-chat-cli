import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { config } from './config.js';

interface DocumentChunk {
  content: string;
  metadata: {
    source: string;
    title: string;
    chunkIndex: number;
  };
}

export async function loadDocuments(): Promise<DocumentChunk[]> {
  console.log('Loading documents from:', config.dataPath);
  
  try {
    const files = await readdir(config.dataPath);
    const htmlFiles = files.filter(file => file.endsWith('.html'));
    
    console.log(`Found ${htmlFiles.length} HTML files`);
    
    const allChunks: DocumentChunk[] = [];
    let totalProcessed = 0;
    
    for (const fileName of htmlFiles) {
      try {
        const filePath = join(config.dataPath, fileName);
        console.log(`Processing: ${fileName}`);
        
        const htmlContent = await readFile(filePath, 'utf-8');
        
        const loader = new CheerioWebBaseLoader(`file://${filePath}`);
        loader.load = async () => {
          const $ = await import('cheerio').then(m => m.load(htmlContent));
          
          const title = $('title').text() || fileName.replace('.html', '');
          const textContent = $('body').text().trim();
          
          return [{
            pageContent: textContent,
            metadata: { 
              source: fileName,
              title: title 
            }
          }];
        };
        
        const docs = await loader.load();
        
        if (docs.length === 0 || !docs[0].pageContent.trim()) {
          console.log(`⚠️  No content found in ${fileName}, skipping`);
          continue;
        }
        
        const splitter = new RecursiveCharacterTextSplitter({
          chunkSize: config.chunkSize,
          chunkOverlap: config.chunkOverlap,
        });
        
        const chunks = await splitter.splitDocuments(docs);
        
        const documentChunks: DocumentChunk[] = chunks.map((chunk, index) => ({
          content: chunk.pageContent,
          metadata: {
            source: fileName,
            title: docs[0].metadata.title as string,
            chunkIndex: index,
          }
        }));
        
        allChunks.push(...documentChunks);
        totalProcessed++;
        
        console.log(`✓ ${fileName}: ${chunks.length} chunks created`);
        
      } catch (error) {
        console.error(`❌ Error processing ${fileName}:`, error);
        continue;
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`- Files processed: ${totalProcessed}/${htmlFiles.length}`);
    console.log(`- Total chunks: ${allChunks.length}`);
    console.log(`- Average chunk size: ${Math.round(allChunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / allChunks.length)} characters`);
    
    return allChunks;
    
  } catch (error) {
    console.error('Error loading documents:', error);
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  loadDocuments()
    .then(chunks => {
      console.log(`\n🎉 Data ingestion completed successfully!`);
      console.log(`Ready for Phase 3: Vector Store creation`);
    })
    .catch(error => {
      console.error('❌ Data ingestion failed:', error);
      process.exit(1);
    });
}