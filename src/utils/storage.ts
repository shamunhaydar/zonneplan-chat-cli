import { mkdir } from 'node:fs/promises';

export async function ensureStorageDirectory(): Promise<void> {
  try {
    await mkdir('./storage', { recursive: true });
  } catch (_error) {
    // Directory might already exist, ignore
  }
}
