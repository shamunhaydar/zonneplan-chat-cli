import { generateChunkId } from '../src/utils/crypto.js';

function testCryptoUtils(): void {
  console.log('\n🧪 Testing Crypto Utils...');

  const tests = [
    {
      name: 'should generate consistent hash for same inputs',
      test: () => {
        const content = 'test content';
        const source = 'test.html';
        const chunkIndex = 0;

        const id1 = generateChunkId(content, source, chunkIndex);
        const id2 = generateChunkId(content, source, chunkIndex);

        if (id1 !== id2) {
          throw new Error(`Expected consistent hashes, got ${id1} and ${id2}`);
        }

        if (!/^[a-f0-9]{64}$/.test(id1)) {
          throw new Error(`Expected SHA-256 format, got ${id1}`);
        }

        console.log('✓ Consistent hash generation');
      },
    },
    {
      name: 'should generate different hashes for different inputs',
      test: () => {
        const content = 'test content';
        const source = 'test.html';

        const id1 = generateChunkId(content, source, 0);
        const id2 = generateChunkId(content, source, 1);
        const id3 = generateChunkId('different content', source, 0);

        if (id1 === id2 || id1 === id3 || id2 === id3) {
          throw new Error('Expected different hashes for different inputs');
        }

        console.log('✓ Different hashes for different inputs');
      },
    },
    {
      name: 'should handle empty content',
      test: () => {
        const id = generateChunkId('', 'test.html', 0);
        if (!/^[a-f0-9]{64}$/.test(id)) {
          throw new Error(`Expected valid hash for empty content, got ${id}`);
        }
        console.log('✓ Empty content handling');
      },
    },
    {
      name: 'should handle special characters',
      test: () => {
        const content = 'content with special chars: áéíóú ñ üß 中文';
        const id = generateChunkId(content, 'test.html', 0);
        if (!/^[a-f0-9]{64}$/.test(id)) {
          throw new Error(`Expected valid hash for special chars, got ${id}`);
        }
        console.log('✓ Special characters handling');
      },
    },
  ];

  for (const testCase of tests) {
    try {
      testCase.test();
    } catch (error) {
      console.error(`❌ ${testCase.name} failed:`, error);
      throw error;
    }
  }

  console.log('✅ All crypto utils tests passed');
}

async function main() {
  try {
    testCryptoUtils();
    console.log('\n✅ All tests completed successfully');
  } catch (error) {
    console.error('❌ Crypto utils test failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
