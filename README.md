# Zonneplan GenAI Chatbot

## Project Description
This project delivers a CLI chatbot that uses Retrieval-Augmented Generation (RAG) to answer questions based on Zonneplan's knowledge base articles (HTML). The bot can retrieve relevant information, generate accurate answers, add source citations, and provide a fallback if no results are available.

## Tech Stack
- Runtime & language: Node.js (v18+) with TypeScript
- Orchestration & RAG: LangChain.js
- HTML parsing: Cheerio (`CheerioWebBaseLoader`)
- Vector database: FAISS (local, via `faiss-node`)
- Embedding model: OpenAI `text-embedding-3-small`
- LLM for generation: OpenAI `gpt-4o-mini`
- CLI interface: Inquirer.js
- Environment variables: dotenv

> Note: All code and comments are written in English for maximum compatibility.

## Installation Instructions
1. Clone the repository
   ```bash
   git clone https://github.com/shamunhaydar/zonneplan-chat-cli.git
   cd zonneplan-chat-cli
   ```
2. Install dependencies
   ```bash
   pnpm install
   ```
3. Create a `.env` file in the project root with the following content:
   ```env
   OPENAI_API_KEY=your_openai_api_key
   ```
4. Ensure you have the `data/` folder with all unzipped HTML articles.

## Project Structure
```
.
├── data/                          # HTML knowledge base articles
├── src/
│   ├── ingest.ts                  # Ingestion + chunking + FAISS build
│   └── chat.ts                    # CLI chatbot with RAG pipeline
├── storage/
│   └── vectorstore.faiss          # Persistent FAISS index
├── .env                           # Environment variables (not committed)
├── package.json
├── tsconfig.json
└── README.md
```

## Usage
1. **Data Ingestion & Index Build**
   ```bash
   pnpm ingest
   ```
   This script:
   - Loads all HTML files from `data/`
   - Parses and splits them into overlapping chunks
   - Generates embeddings via OpenAI
   - Builds and saves the Memory vector store to `vectorstore.faiss.json`

2. **Start Interactive Chatbot**
   ```bash
   pnpm chat
   ```
   This script:
   - Loads the saved vector store
   - Starts an interactive CLI loop with Dutch interface
   - Provides conversation history and source citations
   - Supports commands: help, clear, quit/exit

3. **Run Tests**
   ```bash
   pnpm test
   ```
   Runs comprehensive tests on the RAG pipeline with various queries

4. **Test RAG Pipeline Only**
   ```bash
   pnpm test-rag
   ```
   Tests the core RAG functionality without interactive CLI

## Project Structure
```
.
├── data/                          # HTML knowledge base articles
├── src/
│   ├── config.ts                  # Configuration and environment setup
│   ├── ingest.ts                  # Data ingestion + vector store creation
│   ├── chat.ts                    # Core RAG pipeline implementation
│   └── interactive.ts             # Interactive CLI interface
├── tests/
│   └── rag-tests.ts              # Comprehensive test suite
├── vectorstore.faiss.json        # Persistent Memory vector store
├── .env                          # Environment variables (not committed)
├── package.json
├── tsconfig.json
└── README.md
```

## Architecture

### WSL/Windows Compatibility
This project is designed to work seamlessly in both WSL and Windows environments:
- **Memory Vector Store**: Uses LangChain's MemoryVectorStore instead of FAISS for cross-platform compatibility
- **JSON Persistence**: Vector store data is saved as JSON for easy loading across environments
- **Environment Handling**: Robust environment variable loading that works in various shell contexts

### RAG Pipeline
1. **Document Loading**: HTML files processed with CheerioWebBaseLoader
2. **Text Splitting**: RecursiveCharacterTextSplitter with 1000 char chunks, 200 overlap
3. **Embeddings**: OpenAI text-embedding-3-small model
4. **Vector Storage**: Memory-based with JSON persistence
5. **Retrieval**: Similarity search with configurable top-k (default: 5)
6. **Generation**: GPT-4o-mini with Dutch language prompts
7. **Response**: Structured answers with source citations

## Test Results

### Example Queries and Responses

**Query**: "Wat is saldering bij zonnepanelen?"
**Response**: Saldering bij zonnepanelen is het proces waarbij je de stroom die je zelf opwekt met zonnepanelen, kunt verrekenen met de stroom die je verbruikt...
**Sources**: energie_terugleververgoeding-bij-zonnepanelen

**Query**: "Kan ik een lening krijgen voor zonnepanelen?"  
**Response**: Ja, je kunt een lening krijgen voor zonnepanelen. Veel banken bieden een groene lening aan...
**Sources**: financieel_lening-zonnepanelen

**Query**: "Wat kost een elektriciteitsauto?" (off-topic)
**Response**: Ik kan deze vraag niet beantwoorden op basis van de beschikbare informatie.

## Success Criteria ✅
- ✅ Answers to example questions from solar panel knowledge base
- ✅ Correct source citation per answer  
- ✅ Fallback message when no match is found
- ✅ Simple, stable CLI experience
- ✅ WSL/Windows cross-platform compatibility
- ✅ Dutch language interface and responses
- ✅ Conversation history management