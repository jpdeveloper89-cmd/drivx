import * as fs from 'fs';
import * as path from 'path';
import { ObjectStorageProvider } from './ObjectStorageProvider';

/**
 * Local filesystem implementation of ObjectStorageProvider.
 * Used for development and testing. Stores files in a local directory.
 */
export class LocalFileStorageProvider implements ObjectStorageProvider {
  private readonly basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
    if (!fs.existsSync(basePath)) {
      fs.mkdirSync(basePath, { recursive: true });
    }
  }

  async upload(key: string, data: Buffer, metadata?: Record<string, string>): Promise<string> {
    const filePath = this.resolveFilePath(key);
    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, data);

    // Store metadata in a sidecar file if provided
    if (metadata && Object.keys(metadata).length > 0) {
      const metaPath = filePath + '.meta.json';
      fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
    }

    return `file://${filePath}`;
  }

  async download(key: string): Promise<Buffer> {
    const filePath = this.resolveFilePath(key);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Object not found: ${key}`);
    }

    return fs.readFileSync(filePath);
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolveFilePath(key);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    const metaPath = filePath + '.meta.json';
    if (fs.existsSync(metaPath)) {
      fs.unlinkSync(metaPath);
    }
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.resolveFilePath(key);
    return fs.existsSync(filePath);
  }

  private resolveFilePath(key: string): string {
    return path.join(this.basePath, key);
  }
}
