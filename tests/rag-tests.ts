import { readFile as readFileAsync } from 'fs/promises';
import { RAGChatbot } from '../src/chat.js';

interface TestCase {
  query: string;
  expectedToFind: boolean;
  expectedKeywords?: string[];
  description: string;
}

class TestRunner {
  private chatbot: RAGChatbot;
  private passedTests = 0;
  private totalTests = 0;

  constructor() {
    this.chatbot = new RAGChatbot();
  }

  async setup(): Promise<void> {
    // Set up environment
    if (!process.env.OPENAI_API_KEY) {
      const envContent = await readFileAsync('.env', 'utf-8').catch(() => '');
      const match = envContent.match(/OPENAI_API_KEY=(.+)/);
      if (match) {
        process.env.OPENAI_API_KEY = match[1].trim();
      }
    }

    await this.chatbot.loadVectorStore();
  }

  async runTest(testCase: TestCase): Promise<boolean> {
    console.log(`\n🧪 Test: ${testCase.description}`);
    console.log(`❓ Query: "${testCase.query}"`);

    try {
      const response = await this.chatbot.generateAnswer(testCase.query);

      let passed = true;

      // Check if we expected to find relevant info
      if (testCase.expectedToFind !== response.foundRelevantInfo) {
        console.log(
          `❌ Expected foundRelevantInfo: ${testCase.expectedToFind}, got: ${response.foundRelevantInfo}`
        );
        passed = false;
      }

      // Check for expected keywords in the answer
      if (testCase.expectedKeywords && response.foundRelevantInfo) {
        const answerLower = response.answer.toLowerCase();
        const missingKeywords = testCase.expectedKeywords.filter(
          (keyword) => !answerLower.includes(keyword.toLowerCase())
        );

        if (missingKeywords.length > 0) {
          console.log(`❌ Missing keywords: ${missingKeywords.join(', ')}`);
          passed = false;
        }
      }

      // Display results
      console.log(`💬 Answer: ${response.answer.substring(0, 150)}...`);

      if (response.foundRelevantInfo) {
        console.log(`📚 Sources: ${response.sources.join(', ')}`);
      }

      if (passed) {
        console.log('✅ Test passed');
        this.passedTests++;
      } else {
        console.log('❌ Test failed');
      }

      this.totalTests++;
      return passed;
    } catch (error) {
      console.log(`❌ Test failed with error: ${error}`);
      this.totalTests++;
      return false;
    }
  }

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting comprehensive RAG chatbot tests...\n');

    const testCases: TestCase[] = [
      {
        query: 'Wat is saldering bij zonnepanelen?',
        expectedToFind: true,
        expectedKeywords: ['saldering', 'zonnepanelen', 'stroom'],
        description: 'Solar panel saldering explanation',
      },
      {
        query: 'Hoe werkt de terugleververgoeding?',
        expectedToFind: true,
        expectedKeywords: ['terugleververgoeding', 'vergoeding'],
        description: 'Feed-in tariff explanation',
      },
      {
        query: 'Kan ik een lening krijgen voor zonnepanelen?',
        expectedToFind: true,
        expectedKeywords: ['lening', 'zonnepanelen'],
        description: 'Solar panel financing options',
      },
      {
        query: 'Wat zijn groene leningen?',
        expectedToFind: true,
        expectedKeywords: ['groene lening', 'verduurzaming'],
        description: 'Green loan information',
      },
      {
        query: 'Wat kost een elektriciteitsauto?',
        expectedToFind: false,
        description: 'Irrelevant query - electric car costs',
      },
      {
        query: 'Hoe bak ik een taart?',
        expectedToFind: false,
        description: 'Completely irrelevant query - baking',
      },
      {
        query: 'Hoeveel energie leveren zonnepanelen terug?',
        expectedToFind: true,
        expectedKeywords: ['energie', 'zonnepanelen'],
        description: 'Solar panel energy generation',
      },
    ];

    for (const testCase of testCases) {
      await this.runTest(testCase);
    }

    // Summary
    console.log('\n📊 Test Results:');
    console.log(`✅ Passed: ${this.passedTests}/${this.totalTests}`);
    console.log(
      `❌ Failed: ${this.totalTests - this.passedTests}/${this.totalTests}`
    );
    console.log(
      `📈 Success Rate: ${Math.round((this.passedTests / this.totalTests) * 100)}%`
    );

    if (this.passedTests === this.totalTests) {
      console.log('\n🎉 All tests passed! RAG chatbot is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Review the results above.');
    }
  }
}

// Run tests when executed directly
const isMainModule =
  process.argv[1] &&
  (import.meta.url === `file://${process.argv[1]}` ||
    import.meta.url.includes(process.argv[1].replace(/\\/g, '/')) ||
    process.argv[1].includes('rag-tests.js'));

if (isMainModule) {
  const runner = new TestRunner();

  runner
    .setup()
    .then(() => runner.runAllTests())
    .then(() => {
      console.log('\n🏁 Testing completed.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test runner failed:', error);
      process.exit(1);
    });
}
