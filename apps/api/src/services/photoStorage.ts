import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, open, unlink } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { config } from '../config/index.js';

const MIME_BY_FORMAT: Record<string, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const STORAGE_KEY_PATTERN = /^[0-9a-f-]{36}\.jpg$/i;

export class UnsupportedPhotoError extends Error {}

export class InvalidPhotoError extends Error {}

export interface PhotoStorage {
  save(buffer: Buffer, declaredMimeType: string): Promise<string>;
  open(key: string): Promise<Readable | null>;
  delete(key: string): Promise<void>;
}

export class LocalPhotoStorage implements PhotoStorage {
  private readonly directory: string;

  constructor(uploadDirectory: string) {
    this.directory = path.resolve(uploadDirectory);
    const apiSourceDirectory = path.dirname(fileURLToPath(import.meta.url));
    const webDirectory = path.resolve(apiSourceDirectory, '../../../web');
    const relativeToWeb = path.relative(webDirectory, this.directory);

    if (
      relativeToWeb === '' ||
      (relativeToWeb !== '..' &&
        !relativeToWeb.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relativeToWeb))
    ) {
      throw new Error('UPLOAD_DIR must be outside the frontend directory');
    }
  }

  async save(buffer: Buffer, declaredMimeType: string): Promise<string> {
    let reencoded: Buffer;

    try {
      const image = sharp(buffer, {
        failOn: 'error',
        limitInputPixels: 100_000_000,
      });
      const metadata = await image.metadata();
      const decodedMimeType = metadata.format ? MIME_BY_FORMAT[metadata.format] : undefined;

      if (!decodedMimeType || decodedMimeType !== declaredMimeType) {
        throw new UnsupportedPhotoError();
      }

      reencoded = await image
        .rotate()
        .resize({
          width: 1600,
          height: 1600,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch (error) {
      if (error instanceof UnsupportedPhotoError) {
        throw error;
      }
      throw new InvalidPhotoError();
    }

    await mkdir(this.directory, { recursive: true });
    const key = `${randomUUID()}.jpg`;
    const destination = this.resolvePath(key);
    if (!destination) {
      throw new Error('Generated photo storage key is invalid');
    }

    const handle = await open(destination, 'wx', 0o600);
    try {
      await handle.writeFile(reencoded);
    } catch (error) {
      try {
        await handle.close();
      } catch {
        console.error('[PHOTO_STORAGE] Failed to close an incomplete photo file.');
      }
      await this.removeIncompleteFile(destination);
      throw error;
    }
    try {
      await handle.close();
    } catch (error) {
      await this.removeIncompleteFile(destination);
      throw error;
    }
    return key;
  }

  async open(key: string): Promise<Readable | null> {
    const filePath = this.resolvePath(key);
    if (!filePath) {
      throw new Error('Photo storage key is invalid');
    }

    try {
      await access(filePath);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }

    return createReadStream(filePath);
  }

  private resolvePath(key: string): string | null {
    if (!STORAGE_KEY_PATTERN.test(key)) {
      return null;
    }

    const resolvedPath = path.resolve(this.directory, key);
    if (!resolvedPath.startsWith(`${this.directory}${path.sep}`)) {
      return null;
    }

    return resolvedPath;
  }

  async delete(key: string): Promise<void> {
    const target = this.resolvePath(key);
    if (!target) {
      throw new Error('Photo storage key is invalid');
    }

    try {
      await unlink(target);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return;
      }
      throw error;
    }
  }

  private async removeIncompleteFile(filePath: string): Promise<void> {
    try {
      await unlink(filePath);
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return;
      }
      console.error('[PHOTO_STORAGE] Failed to remove an incomplete photo file.');
    }
  }
}

export const photoStorage: PhotoStorage = new LocalPhotoStorage(config.uploadDir);
