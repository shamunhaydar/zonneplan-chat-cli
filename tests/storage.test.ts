import { readdir } from 'node:fs/promises';
import { ensureStorageDirectory } from '../src/utils/storage.js';

async function testStorageUtils(): Promise<void> {
  console.log('\n🧪 Testing Storage Utils...');

  const tests = [
    {
      name: 'should create storage directory',
      test: async () => {
        await ensureStorageDirectory();

        try {
          await readdir('./storage');
          console.log('✓ Storage directory exists and is accessible');
        } catch (_error) {
          throw new Error('Failed to access storage directory after creation');
        }
      },
    },
    {
      name: 'should handle existing directory gracefully',
      test: async () => {
        // Call twice to ensure no errors when directory exists
        await ensureStorageDirectory();
        await ensureStorageDirectory();
        console.log('✓ Handles existing directory gracefully');
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

  console.log('✅ All storage utils tests passed');
}

async function main() {
  try {
    await testStorageUtils();
    console.log('\n✅ All tests completed successfully');
  } catch (error) {
    console.error('❌ Storage utils test failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
