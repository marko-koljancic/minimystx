/**
 * ZIP reader/writer abstraction over fflate library
 * Provides streaming operations for large files
 */

import { zip, unzip, AsyncZipOptions, Zippable } from 'fflate';
import type { ZipWriter, ZipReader } from './types';
import { ZipError } from './types';

/**
 * Streaming ZIP writer implementation
 */
export class FflateZipWriter implements ZipWriter {
  private files: Zippable = {};
  private finalized = false;

  /**
   * Add a file to the ZIP
   */
  async addFile(pathInZip: string, data: Uint8Array): Promise<void> {
    if (this.finalized) {
      throw new ZipError('Cannot add files to finalized ZIP');
    }

    // Validate path
    if (!pathInZip || pathInZip.includes('..') || pathInZip.startsWith('/')) {
      throw new ZipError(`Invalid ZIP path: ${pathInZip}`);
    }

    this.files[pathInZip] = data;
  }

  /**
   * Add a text file to the ZIP
   */
  async addText(pathInZip: string, text: string): Promise<void> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    await this.addFile(pathInZip, data);
  }

  /**
   * Finalize the ZIP and return the compressed data
   */
  async finalize(): Promise<Uint8Array> {
    if (this.finalized) {
      throw new ZipError('ZIP already finalized');
    }

    this.finalized = true;

    return new Promise((resolve, reject) => {
      const options: AsyncZipOptions = {
        level: 6, // Good compression vs speed tradeoff
      };

      zip(this.files, options, (err, data) => {
        if (err) {
          reject(new ZipError(`ZIP creation failed: ${err.message}`));
        } else {
          resolve(data);
        }
      });
    });
  }
}

/**
 * ZIP reader implementation
 */
export class FflateZipReader implements ZipReader {
  private zipData: Uint8Array;
  private unzipped: { [path: string]: Uint8Array } | null = null;

  constructor(zipData: Uint8Array | ArrayBuffer) {
    this.zipData = zipData instanceof ArrayBuffer ? new Uint8Array(zipData) : zipData;
  }

  /**
   * Extract all files from ZIP (lazy initialization)
   */
  private async ensureUnzipped(): Promise<void> {
    if (this.unzipped !== null) {
      return;
    }

    return new Promise((resolve, reject) => {
      unzip(this.zipData, (err, data) => {
        if (err) {
          reject(new ZipError(`ZIP extraction failed: ${err.message}`));
        } else {
          this.unzipped = data;
          resolve();
        }
      });
    });
  }

  /**
   * List all files in the ZIP
   */
  async list(): Promise<string[]> {
    await this.ensureUnzipped();
    return Object.keys(this.unzipped!);
  }

  /**
   * Read a file from the ZIP
   */
  async readFile(pathInZip: string): Promise<Uint8Array> {
    await this.ensureUnzipped();
    
    const file = this.unzipped![pathInZip];
    if (!file) {
      throw new ZipError(`File not found in ZIP: ${pathInZip}`);
    }
    
    return file;
  }

  /**
   * Read a text file from the ZIP
   */
  async readText(pathInZip: string): Promise<string> {
    const data = await this.readFile(pathInZip);
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(data);
  }

  /**
   * Check if a file exists in the ZIP
   */
  async has(pathInZip: string): Promise<boolean> {
    await this.ensureUnzipped();
    return pathInZip in this.unzipped!;
  }

  /**
   * Get file size without reading the full content
   */
  async getFileSize(pathInZip: string): Promise<number> {
    await this.ensureUnzipped();
    const file = this.unzipped![pathInZip];
    if (!file) {
      throw new ZipError(`File not found in ZIP: ${pathInZip}`);
    }
    return file.length;
  }
}

/**
 * Utility functions for ZIP operations
 */

/**
 * Create a ZIP writer instance
 */
export function createZipWriter(): ZipWriter {
  return new FflateZipWriter();
}

/**
 * Create a ZIP reader instance from data
 */
export function createZipReader(data: Uint8Array | ArrayBuffer): ZipReader {
  return new FflateZipReader(data);
}

/**
 * Validate ZIP file structure for .mxscene format
 */
export async function validateMxSceneZip(reader: ZipReader): Promise<void> {
  const files = await reader.list();
  
  // Check required files
  if (!files.includes('manifest.json')) {
    throw new ZipError('Invalid .mxscene file: missing manifest.json');
  }
  
  if (!files.includes('scene.json')) {
    throw new ZipError('Invalid .mxscene file: missing scene.json');
  }
  
  // Check assets directory structure
  const assetFiles = files.filter(f => f.startsWith('assets/'));
  
  // Validate asset filenames (should be in format: assets/<hash>-<filename>)
  for (const assetFile of assetFiles) {
    const fileName = assetFile.substring('assets/'.length);
    if (!fileName.includes('-') || fileName.length < 65) { // 64 char hash + dash + filename
      throw new ZipError(`Invalid asset filename format: ${assetFile}`);
    }
  }
  
  console.info(`[validateMxSceneZip] Valid .mxscene structure: ${files.length} files, ${assetFiles.length} assets`);
}

/**
 * Generate asset filename for ZIP storage
 */
export function generateAssetFilename(hash: string, originalName: string): string {
  // Sanitize original name to ensure safe storage
  const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `assets/${hash}-${safeName}`;
}

/**
 * Parse asset filename to extract hash and original name
 */
export function parseAssetFilename(filename: string): { hash: string; originalName: string } | null {
  if (!filename.startsWith('assets/')) {
    return null;
  }
  
  const name = filename.substring('assets/'.length);
  const dashIndex = name.indexOf('-');
  
  if (dashIndex < 0 || dashIndex !== 64) { // SHA-256 is 64 chars
    return null;
  }
  
  const hash = name.substring(0, dashIndex);
  const originalName = name.substring(dashIndex + 1);
  
  return { hash, originalName };
}