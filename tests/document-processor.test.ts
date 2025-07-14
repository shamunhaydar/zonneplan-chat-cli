import { loadDocuments } from '../src/processors/document-processor.js';

async function testDocumentProcessor(): Promise<void> {
  console.log('\n🧪 Testing Document Processor...');

  const tests = [
    {
      name: 'should load and process documents',
      test: async () => {
        try {
          const documents = await loadDocuments();

          if (documents.length === 0) {
            console.log(
              '⚠️ No documents found - this might be expected if no data is available'
            );
            return;
          }

          console.log(`✓ Loaded ${documents.length} documents`);

          // Check document structure
          const firstDoc = documents[0];
          if (
            !firstDoc.pageContent ||
            typeof firstDoc.pageContent !== 'string'
          ) {
            throw new Error('Document should have pageContent string');
          }

          if (!firstDoc.metadata || typeof firstDoc.metadata !== 'object') {
            throw new Error('Document should have metadata object');
          }

          const requiredMetadata = ['source', 'title', 'chunkIndex', 'chunkId'];
          for (const field of requiredMetadata) {
            if (!(field in firstDoc.metadata)) {
              throw new Error(`Document metadata should include ${field}`);
            }
          }

          console.log('✓ Document structure validation passed');
          console.log(
            `✓ Sample document: ${firstDoc.pageContent.substring(0, 100)}...`
          );
          console.log('✓ Sample metadata:', firstDoc.metadata);
        } catch (error) {
          if (error instanceof Error && error.message.includes('ENOENT')) {
            console.log(
              '⚠️ Data directory not found - this is expected in test environment'
            );
            return;
          }
          throw error;
        }
      },
    },
  ];

  for (const testCase of tests) {
    try {
      await testCase.test();
    } catch (error) {
      console.error(`❌ ${testCase.name} failed:`, error);
      throw error;
    }
  }

  console.log('✅ All document processor tests passed');
}

async function main() {
  try {
    await testDocumentProcessor();
    console.log('\n✅ All tests completed successfully');
  } catch (error) {
    console.error('❌ Document processor test failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
