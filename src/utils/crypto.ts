import { createHash } from 'node:crypto';

export function generateChunkId(
  content: string,
  source: string,
  chunkIndex: number
): string {
  const hash = createHash('sha256');
  hash.update(`${source}-${chunkIndex}-${content}`);
  return hash.digest('hex');
}
