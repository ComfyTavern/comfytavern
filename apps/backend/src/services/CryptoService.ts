import { AES, enc, mode, pad } from 'crypto-js';
import { Buffer } from 'node:buffer'; // 用于 Base64 编码/解码和随机字节生成

// 主加密密钥 (MEK) - 从环境变量读取
const MEK_ENV_VAR = 'COMFYTAVERN_MASTER_ENCRYPTION_KEY';
let masterEncryptionKey: string | undefined; // 初始化为 undefined，以便首次检查

function getMasterEncryptionKey(): string {
  if (masterEncryptionKey) {
    return masterEncryptionKey;
  }
  const mek = process.env[MEK_ENV_VAR];
  if (!mek) {
    const errorMessage = `[CryptoService] CRITICAL ERROR: Master Encryption Key (MEK) environment variable "${MEK_ENV_VAR}" is not set. External service credentials cannot be encrypted or decrypted. Please set this environment variable to a strong, random key (e.g., 32 bytes, base64 encoded).`;
    console.error(errorMessage);
    // 在生产环境中，这应该导致应用启动失败或进入安全模式
    throw new Error(errorMessage);
  }
  // crypto-js 会将字符串密钥直接用于加密算法。
  // AES-256 需要 32 字节 (256 位) 的密钥。
  // 如果 mek 是 Base64 编码的32字节随机数据，解码后应为32字节。
  // 或者，如果 mek 是一个足够长的密码，可以考虑使用 KDF (如 PBKDF2) 从它派生出32字节的密钥。
  // 为简单起见，这里直接使用 mek 字符串作为密钥。crypto-js 内部会处理。
  // 重要的是用户提供的 MEK 字符串本身具有高熵。
  masterEncryptionKey = mek;
  console.log(`[CryptoService] Master Encryption Key (MEK) loaded from environment variable "${MEK_ENV_VAR}".`);
  return masterEncryptionKey;
}

export class CryptoService {
  /**
   * Hashes a plaintext string (e.g., password or API key secret).
   * Uses Bun.password which defaults to bcrypt and handles salting automatically.
   * @param plaintext The string to hash.
   * @returns A promise that resolves to the hashed string.
   */
  static async hash(plaintext: string): Promise<string> {
    if (!plaintext) {
      throw new Error('[CryptoService] Plaintext for hashing cannot be empty.');
    }
    return Bun.password.hash(plaintext);
  }

  /**
   * Verifies a plaintext string against a hash.
   * @param plaintext The plaintext string.
   * @param hash The hash to verify against.
   * @returns A promise that resolves to true if the plaintext matches the hash, false otherwise.
   */
  static async verify(plaintext: string, hash: string): Promise<boolean> {
    if (!plaintext || !hash) {
      // Bun.password.verify might throw or return false for empty/null hash.
      // Explicitly returning false for clarity and to avoid potential issues.
      console.warn('[CryptoService] Attempted to verify with empty plaintext or hash.');
      return false;
    }
    try {
      return await Bun.password.verify(plaintext, hash);
    } catch (error) {
      console.error('[CryptoService] Error during password verification:', error);
      return false; // Treat verification errors as mismatch
    }
  }

  /**
   * Encrypts a plaintext string using AES-256-CBC with PKCS7 padding.
   * A new 16-byte IV is generated for each encryption.
   * The IV (hex) is prepended to the ciphertext (Base64), separated by a colon.
   * Format: "iv_hex:ciphertext_base64"
   * @param plaintext The string to encrypt.
   * @returns The encrypted string.
   * @throws Error if MEK is not set.
   */
  static encryptCredential(plaintext: string): string {
    const mek = getMasterEncryptionKey(); // Ensures MEK is loaded or throws
    
    // Generate a 16-byte (128-bit) random IV
    const ivBuffer = Buffer.from(crypto.getRandomValues(new Uint8Array(16)));
    const iv = enc.Hex.parse(ivBuffer.toString('hex'));

    const encrypted = AES.encrypt(plaintext, enc.Utf8.parse(mek), {
        iv: iv,
        mode: mode.CBC,
        padding: pad.Pkcs7
    });

    const ivHex = enc.Hex.stringify(iv);
    // encrypted.ciphertext is a WordArray object from crypto-js
    const ciphertextBase64 = enc.Base64.stringify(encrypted.ciphertext);

    return `${ivHex}:${ciphertextBase64}`;
  }

  /**
   * Decrypts a string previously encrypted with encryptCredential.
   * Expects "iv_hex:ciphertext_base64" format.
   * @param encryptedString The string to decrypt.
   * @returns The decrypted plaintext string.
   * @throws Error if MEK is not set, format is invalid, or decryption fails.
   */
  static decryptCredential(encryptedString: string): string {
    const mek = getMasterEncryptionKey(); // Ensures MEK is loaded or throws

    if (!encryptedString || typeof encryptedString !== 'string' || !encryptedString.includes(':')) {
      throw new Error('[CryptoService] Invalid encrypted string format. Expected "iv_hex:ciphertext_base64".');
    }

    const parts = encryptedString.split(':');
    if (parts.length !== 2) {
      throw new Error('[CryptoService] Invalid encrypted string format. Expected "iv_hex:ciphertext_base64".');
    }

    const ivHex = parts[0];
    const ciphertextBase64 = parts[1];

    if (!ivHex || !ciphertextBase64) {
        throw new Error('[CryptoService] Invalid encrypted string format. IV or Ciphertext is missing.');
    }

    const iv = enc.Hex.parse(ivHex);
    const ciphertext = enc.Base64.parse(ciphertextBase64);

    const decrypted = AES.decrypt({ ciphertext: ciphertext } as any, enc.Utf8.parse(mek), { // `as any` to satisfy CipherParams structure for crypto-js
        iv: iv,
        mode: mode.CBC,
        padding: pad.Pkcs7
    });

    try {
        const plaintext = enc.Utf8.stringify(decrypted);
        if (!plaintext && encryptedString) { // If plaintext is empty but original encrypted string was not, it's likely a decryption failure
            throw new Error('Decryption resulted in empty plaintext, possibly due to incorrect key or corrupted data.');
        }
        return plaintext;
    } catch (error) {
        // This catch block handles errors from enc.Utf8.stringify if decrypted WordArray is invalid
        console.error('[CryptoService] Error stringifying decrypted data:', error);
        throw new Error('[CryptoService] Decryption failed. The key may be incorrect or the data corrupted.');
    }
  }
}

// Initial check for MEK when the module is loaded.
// This helps to identify configuration issues early.
try {
  getMasterEncryptionKey();
} catch (e) {
  // The error is already logged by getMasterEncryptionKey.
  // We don't want to crash the app here if it's just loading,
  // but subsequent calls to encrypt/decrypt will fail if MEK isn't fixed.
  console.warn(`[CryptoService] Initial check for MEK failed. Credential encryption/decryption will not work until "${MEK_ENV_VAR}" is correctly set.`);
}