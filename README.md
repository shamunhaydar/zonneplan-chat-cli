# Zonneplan GenAI Chatbot

## Projectbeschrijving  
Dit project levert een CLI-chatbot die met behulp van Retrieval-Augmented Generation (RAG) vragen beantwoordt op basis van de Zonneplan kennisbank-artikelen (HTML). De bot kan relevante informatie ophalen, accurate antwoorden genereren, bronvermeldingen toevoegen en een fallback bieden als er geen resultaat beschikbaar is.

## Tech Stack  
- Runtime & taal: Node.js (v18+) met TypeScript  
- Orchestration & RAG: LangChain.js  
- HTML-parsing: Cheerio (`CheerioWebBaseLoader`)  
- Vector database: FAISS (lokaal, via `faiss-node`)  
- Embedding model: OpenAI `text-embedding-3-small`  
- LLM voor generatie: OpenAI `gpt-4o-mini`  
- CLI-interface: Inquirer.js  
- Omgevingsvariabelen: dotenv

> Let op: alle code en comments zijn in het Engels geschreven voor maximale compatibiliteit.

## Installatie-instructies  
1. Clone de repository  
   ```bash
   git clone https://github.com/shamunhaydar/zonneplan-chat-cli.git
   cd zonneplan-chat-cli
   ```  
2. Installeer dependencies  
   ```bash
   npm install
   ```  
3. Maak een `.env`-bestand in de projectroot met de volgende inhoud:  
   ```env
   OPENAI_API_KEY=your_openai_api_key
   VECTORSTORE_PATH=./storage/vectorstore.faiss
   ```  
4. Zorg dat je de `data/`-map hebt met alle uitgepakte HTML-artikelen.

## Projectstructuur  
```
.
├── data/                          # HTML kennisbank-artikelen
├── src/
│   ├── ingest.ts                  # Ingestion + chunking + FAISS build
│   └── chat.ts                    # CLI-chatbot met RAG-pipeline
├── storage/
│   └── vectorstore.faiss          # Persistente FAISS-index
├── .env                           # Omgevingsvariabelen (niet committed)
├── package.json
├── tsconfig.json
└── README.md
```

## Gebruik  
1. **Data Ingestion & Index Build**  
   ```bash
   npm run ingest
   ```  
   Dit script:
   - Laadt alle HTML-bestanden uit `data/`
   - Parseert en splitst ze in overlappingende chunks
   - Genereert embeddings via OpenAI
   - Bouwt en slaat de FAISS-index op in `storage/vectorstore.faiss`

2. **Chatbot starten**  
   ```bash
   npm run chat
   ```  
   Dit script:
   - Laadt de opgeslagen FAISS-index
   - Start een Inquirer.js CLI-loop
   - Embedt de vraag, zoekt relevante chunks, genereert antwoord met bronvermelding
   - Gebruikt een fallback wanneer er geen relevante informatie gevonden wordt

## Succescriteria  
Een werkend prototype voldoet aan:
- Antwoorden op voorbeeldvragen uit de casus (bv. garantietermijn, omvormer werking)  
- Correcte bronvermelding per antwoord  
- Fallback-bericht wanneer geen match gevonden is  
- Eenvoudige, stabiele CLI-ervaring  