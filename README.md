# Zonneplan GenAI Chatbot

## Project Description
This project delivers a CLI chatbot that uses Retrieval-Augmented Generation (RAG) to answer questions based on Zonneplan's knowledge base articles (HTML). The bot can retrieve relevant information, generate accurate answers, add source citations, and provide a fallback if no results are available.

## Prerequisites
- **Docker**: Required for running ChromaDB
- **Node.js**: v18+ (LTS recommended)
- **pnpm**: Package manager (install via `npm install -g pnpm`)
- **OpenAI API Key**: Required for embeddings and LLM generation

## Tech Stack
- Runtime & language: Node.js (v18+) with TypeScript
- Orchestration & RAG: LangChain.js (simplified imports for compatibility)
- HTML parsing: Cheerio (`CheerioWebBaseLoader`)
- Vector database: ChromaDB (Docker-based)
- Vector store fallback: MemoryVectorStore (JSON-based for cross-platform compatibility)
- Embedding model: OpenAI `text-embedding-3-small`
- LLM for generation: OpenAI `gpt-4o-mini`
- CLI interface: Inquirer.js
- Environment variables: dotenv


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
3. Copy the environment template
   ```bash
   cp .env.example .env
   ```
   Update `.env` with your OpenAI API key and ChromaDB settings if needed.
4. Ensure you have the `data/` folder with all unzipped HTML articles.

## Running the Project
1. **Start ChromaDB** (Docker required):
   ```bash
   docker compose up -d
   ```
   This will start ChromaDB on `localhost:8000` with persistent storage.
2. **Ingest Data**:
   ```bash
   pnpm ingest
   ```
   This will parse HTML files, generate embeddings, and create the vector store.
3. **Start the Chatbot**:
   ```bash
   pnpm chat
   ```
   This will launch an interactive CLI chatbot that can answer questions based on the knowledge base.
4. **Run Tests**:
   ```bash
   pnpm test
   ```
   This will execute tests on the RAG pipeline and ensure everything is functioning correctly.

## Project Structure
```
.
├── data/                          # HTML knowledge base articles
├── src/
│   ├── config.ts                  # Configuration and environment setup
│   ├── ingest.ts                  # Data ingestion + vector store creation
│   ├── chat.ts                    # Core RAG pipeline implementation
│   ├── interactive.ts             # Interactive CLI interface
│   └── index.ts                   # Main entry point
├── tests/
│   ├── chat.tests.ts
│   └── rag.tests.ts
├── storage/
│   ├── chromadb/                  # ChromaDB persistent storage
│   └── vectorstore.faiss.json    # Persistent Memory vector store
├── .env                          # Environment variables
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
   - Builds and saves the vector store

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