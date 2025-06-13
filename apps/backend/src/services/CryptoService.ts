import { AES, enc, mode, pad } from "crypto-js";
import { Buffer } from "node:buffer"; // 用于 Base64 编码/解码和随机字节生成
import { ENABLE_CREDENTIAL_ENCRYPTION, MASTER_ENCRYPTION_KEY } from "../config"; // 新增导入

// 主加密密钥 (MEK) - 从配置读取
let masterEncryptionKey: string | undefined;
// mekStatus: 'initial' -> 尚未检查
//            'loaded' -> 密钥已加载
//            'disabled_by_config' -> 配置中禁用了加密
//            'key_not_set' -> 配置中启用但环境变量未设置密钥
let mekStatus: "initial" | "loaded" | "disabled_by_config" | "key_not_set" = "initial";

function getMasterEncryptionKey(): string | undefined {
  // 如果已经有明确状态（非 initial），则直接根据状态返回
  if (mekStatus === "loaded" && masterEncryptionKey) {
    return masterEncryptionKey;
  }
  if (mekStatus === "disabled_by_config" || mekStatus === "key_not_set") {
    return undefined;
  }

  // 首次检查或状态为 initial
  if (!ENABLE_CREDENTIAL_ENCRYPTION) {
    console.warn(
      `[CryptoService] Credential encryption is DISABLED via configuration (config.security.enableCredentialEncryption is false). Encryption features will not be available.`
    );
    mekStatus = "disabled_by_config";
    masterEncryptionKey = undefined;
    return undefined;
  }
  // 配置中启用了加密，现在检查配置中的密钥值
  const mek = MASTER_ENCRYPTION_KEY; // 直接使用从配置导入的密钥
  if (!mek) {
    // mek 可能是 undefined 或空字符串
    console.warn(
      `[CryptoService] Credential encryption is ENABLED in config, but Master Encryption Key (MEK) is not set in the configuration file (config.security.masterEncryptionKeyValue). Encryption features are disabled.`
    );
    mekStatus = "key_not_set";
    masterEncryptionKey = undefined;
    return undefined;
  }

  masterEncryptionKey = mek;
  mekStatus = "loaded";
  console.log(
    `[CryptoService] Master Encryption Key (MEK) loaded from configuration file (config.security.masterEncryptionKeyValue). Encryption features are enabled.`
  );
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
      throw new Error("[CryptoService] Plaintext for hashing cannot be empty.");
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
      console.warn("[CryptoService] Attempted to verify with empty plaintext or hash.");
      return false;
    }
    try {
      return await Bun.password.verify(plaintext, hash);
    } catch (error) {
      console.error("[CryptoService] Error during password verification:", error);
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
    const mek = getMasterEncryptionKey();
    if (!mek) {
      // 如果 MEK 未设置，则抛出错误，而不是尝试加密
      throw new Error(
        "[CryptoService] Cannot encrypt credential. Master Encryption Key (MEK) is not configured. Encryption is disabled."
      );
    }

    // Generate a 16-byte (128-bit) random IV
    const ivBuffer = Buffer.from(crypto.getRandomValues(new Uint8Array(16)));
    const iv = enc.Hex.parse(ivBuffer.toString("hex"));

    const encrypted = AES.encrypt(plaintext, enc.Utf8.parse(mek), {
      iv: iv,
      mode: mode.CBC,
      padding: pad.Pkcs7,
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
    const mek = getMasterEncryptionKey();
    if (!mek) {
      // 如果 MEK 未设置，则抛出错误
      throw new Error(
        "[CryptoService] Cannot decrypt credential. Master Encryption Key (MEK) is not configured. Decryption is disabled."
      );
    }

    if (!encryptedString || typeof encryptedString !== "string" || !encryptedString.includes(":")) {
      throw new Error(
        '[CryptoService] Invalid encrypted string format. Expected "iv_hex:ciphertext_base64".'
      );
    }

    const parts = encryptedString.split(":");
    if (parts.length !== 2) {
      throw new Error(
        '[CryptoService] Invalid encrypted string format. Expected "iv_hex:ciphertext_base64".'
      );
    }

    const ivHex = parts[0];
    const ciphertextBase64 = parts[1];

    if (!ivHex || !ciphertextBase64) {
      throw new Error(
        "[CryptoService] Invalid encrypted string format. IV or Ciphertext is missing."
      );
    }

    const iv = enc.Hex.parse(ivHex);
    const ciphertext = enc.Base64.parse(ciphertextBase64);

    const decrypted = AES.decrypt({ ciphertext: ciphertext } as any, enc.Utf8.parse(mek), {
      // `as any` to satisfy CipherParams structure for crypto-js
      iv: iv,
      mode: mode.CBC,
      padding: pad.Pkcs7,
    });

    try {
      const plaintext = enc.Utf8.stringify(decrypted);
      if (!plaintext && encryptedString) {
        // If plaintext is empty but original encrypted string was not, it's likely a decryption failure
        throw new Error(
          "Decryption resulted in empty plaintext, possibly due to incorrect key or corrupted data."
        );
      }
      return plaintext;
    } catch (error) {
      // This catch block handles errors from enc.Utf8.stringify if decrypted WordArray is invalid
      console.error("[CryptoService] Error stringifying decrypted data:", error);
      throw new Error(
        "[CryptoService] Decryption failed. The key may be incorrect or the data corrupted."
      );
    }
  }
}

// 调整模块加载时的初始检查逻辑
// getMasterEncryptionKey() 会在首次调用时打印适当的日志（已加载或未设置）
// 所以这里不需要额外的 try-catch 或日志。
// 确保 getMasterEncryptionKey 被调用一次以触发初始日志记录和状态设置。
getMasterEncryptionKey();
