/**
 * Object Storage Provider Interface
 * Abstraction layer for S3-compatible storage.
 * Implementations can target AWS S3, MinIO, or local filesystem (dev).
 */
export interface ObjectStorageProvider {
  /**
   * Upload encrypted data to object storage.
   * @param key - The storage key/path for the object
   * @param data - The encrypted data buffer to store
   * @param metadata - Optional metadata to attach to the object
   * @returns The storage reference URI
   */
  upload(key: string, data: Buffer, metadata?: Record<string, string>): Promise<string>;

  /**
   * Download data from object storage.
   * @param key - The storage key/path for the object
   * @returns The stored data buffer
   */
  download(key: string): Promise<Buffer>;

  /**
   * Delete an object from storage.
   * @param key - The storage key/path for the object
   */
  delete(key: string): Promise<void>;

  /**
   * Check if an object exists in storage.
   * @param key - The storage key/path for the object
   */
  exists(key: string): Promise<boolean>;
}
