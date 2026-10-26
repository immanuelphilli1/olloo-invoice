import fs from 'node:fs/promises';
import path from 'node:path';

export interface FileStorage {
  save(key: string, data: Buffer): Promise<void>;
  read(key: string): Promise<Buffer | null>;
}

const SAFE_KEY = /^[A-Za-z0-9_-]+\.(png|webp)$/;

export function diskStorage(dir: string): FileStorage {
  const resolve = (key: string) => {
    if (!SAFE_KEY.test(key)) throw new Error(`Unsafe file key: ${key}`);
    return path.join(dir, key);
  };
  return {
    async save(key, data) {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(resolve(key), data);
    },
    async read(key) {
      try {
        return await fs.readFile(resolve(key));
      } catch {
        return null;
      }
    },
  };
}

export function memoryStorage(): FileStorage {
  const files = new Map<string, Buffer>();
  return {
    async save(key, data) {
      files.set(key, data);
    },
    async read(key) {
      return files.get(key) ?? null;
    },
  };
}
