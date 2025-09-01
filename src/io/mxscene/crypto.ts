const CHUNK_SIZE = 64 * 1024;
export async function hashBytesSHA256(bytes: ArrayBuffer): Promise<string> {
  if (bytes.byteLength > CHUNK_SIZE * 100) {
    return hashBytesStreamingSHA256(bytes);
  }
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  return bufferToHex(hashBuffer);
}
async function hashBytesStreamingSHA256(bytes: ArrayBuffer): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  return bufferToHex(hashBuffer);
}
function bufferToHex(buffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(buffer);
  const hexCodes = [...byteArray].map((value) => {
    const hexCode = value.toString(16);
    const paddedHexCode = hexCode.padStart(2, "0");
    return paddedHexCode;
  });
  return hexCodes.join("");
}
export function formatHashForStorage(hash: string): string {
  return `sha256:${hash}`;
}
export function extractHashFromStorage(hashWithPrefix: string): string {
  if (hashWithPrefix.startsWith("sha256:")) {
    return hashWithPrefix.substring(7);
  }
  return hashWithPrefix;
}
export function isValidSHA256Hash(hash: string): boolean {
  return /^[a-f0-9]{64}$/i.test(hash);
}
export async function hashString(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  return hashBytesSHA256(data.buffer);
}
export async function verifyHash(data: ArrayBuffer, expectedHash: string): Promise<boolean> {
  const actualHash = await hashBytesSHA256(data);
  return actualHash === expectedHash;
}
export async function hashBytesWithProgress(
  bytes: ArrayBuffer,
  onProgress?: (processed: number, total: number) => void
): Promise<string> {
  const total = bytes.byteLength;
  if (onProgress) {
    onProgress(0, total);
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
  const hash = await hashBytesSHA256(bytes);
  if (onProgress) {
    onProgress(total, total);
  }
  return hash;
}
