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
   npm run ingest
   ```
   This script:
   - Loads all HTML files from `data/`
   - Parses and splits them into overlapping chunks
   - Generates embeddings via OpenAI
   - Builds and saves the FAISS index to `storage/vectorstore.faiss`

2. **Start Chatbot**
   ```bash
   npm run chat
   ```
   This script:
   - Loads the saved FAISS index
   - Starts an Inquirer.js CLI loop
   - Embeds the question, searches for relevant chunks, generates an answer with source citations
   - Uses a fallback when no relevant information is found

## Success Criteria
A working prototype meets the following:
- Answers to example questions from the case study (e.g., warranty period, inverter operation)
- Correct source citation per answer
- Fallback message when no match is found
- Simple, stable CLI experience