import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { config } from './config.js';

console.log('Data ingestion script - Phase 2 placeholder');

export async function loadDocuments() {
  console.log('Loading documents from:', config.dataPath);
}