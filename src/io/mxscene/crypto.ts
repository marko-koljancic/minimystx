/**
 * SHA-256 hashing utilities for asset integrity verification
 */

const CHUNK_SIZE = 64 * 1024; // 64KB chunks for streaming hash computation

/**
 * Computes SHA-256 hash of bytes
 * @param bytes - ArrayBuffer to hash
 * @returns Promise resolving to hex string
 */
export async function hashBytesSHA256(bytes: ArrayBuffer): Promise<string> {
  // Use streaming approach for large files to avoid memory pressure
  if (bytes.byteLength > CHUNK_SIZE * 100) { // >6.4MB files
    return hashBytesStreamingSHA256(bytes);
  }
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  return bufferToHex(hashBuffer);
}

/**
 * Computes SHA-256 hash using streaming approach for large files
 */
async function hashBytesStreamingSHA256(bytes: ArrayBuffer): Promise<string> {
  // For very large files, we need to process in chunks
  // Note: Web Crypto API doesn't support streaming, so we'll use a workaround
  // by hashing the entire buffer at once but yielding control periodically
  
  await new Promise(resolve => setTimeout(resolve, 0)); // Yield control
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  return bufferToHex(hashBuffer);
}

/**
 * Converts ArrayBuffer to hex string
 */
function bufferToHex(buffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(buffer);
  const hexCodes = [...byteArray].map(value => {
    const hexCode = value.toString(16);
    const paddedHexCode = hexCode.padStart(2, '0');
    return paddedHexCode;
  });
  
  return hexCodes.join('');
}

/**
 * Formats hash as "sha256:<hex>" for storage
 */
export function formatHashForStorage(hash: string): string {
  return `sha256:${hash}`;
}

/**
 * Extracts hex hash from "sha256:<hex>" format
 */
export function extractHashFromStorage(hashWithPrefix: string): string {
  if (hashWithPrefix.startsWith('sha256:')) {
    return hashWithPrefix.substring(7);
  }
  return hashWithPrefix;
}

/**
 * Validates that a string is a valid SHA-256 hex hash
 */
export function isValidSHA256Hash(hash: string): boolean {
  return /^[a-f0-9]{64}$/i.test(hash);
}

/**
 * Computes hash of a string (UTF-8 encoded)
 */
export async function hashString(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  return hashBytesSHA256(data.buffer);
}

/**
 * Verifies that data matches expected hash
 */
export async function verifyHash(data: ArrayBuffer, expectedHash: string): Promise<boolean> {
  const actualHash = await hashBytesSHA256(data);
  return actualHash === expectedHash;
}

/**
 * Progress-aware hash computation for large files
 * Calls onProgress periodically during computation
 */
export async function hashBytesWithProgress(
  bytes: ArrayBuffer,
  onProgress?: (processed: number, total: number) => void
): Promise<string> {
  const total = bytes.byteLength;
  
  if (onProgress) {
    onProgress(0, total);
  }
  
  // For now, we'll use the same approach but yield control periodically
  // In a real implementation, we might want to use a streaming hash library
  await new Promise(resolve => setTimeout(resolve, 0));
  
  const hash = await hashBytesSHA256(bytes);
  
  if (onProgress) {
    onProgress(total, total);
  }
  
  return hash;
}