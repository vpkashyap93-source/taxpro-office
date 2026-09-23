/** Storage driver contract. Add S3/GCS/Azure drivers by implementing this interface. */
export interface StorageDriver {
  readonly name: string;
  put(key: string, data: Buffer, mimeType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}
