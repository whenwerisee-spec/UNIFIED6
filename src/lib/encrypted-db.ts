import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Institutional-Grade Encrypted Storage Engine
 * Provides AES-256-GCM encryption for the Sovereign Ledger.
 */
export class EncryptedStorage {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 16;
  private static readonly SALT_LENGTH = 64;
  private static readonly TAG_LENGTH = 16;

  /**
   * Encrypts a string using a high-entropy master key.
   */
  public static encrypt(plainText: string, masterKey: string): string {
    const salt = crypto.randomBytes(this.SALT_LENGTH);
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const key = crypto.scryptSync(masterKey, salt, 32);

    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
  }

  /**
   * Decrypts a payload. Returns null if key is invalid.
   */
  public static decrypt(cipherText: string, masterKey: string): string | null {
    try {
      const buffer = Buffer.from(cipherText, 'base64');

      const salt = buffer.subarray(0, this.SALT_LENGTH);
      const iv = buffer.subarray(this.SALT_LENGTH, this.SALT_LENGTH + this.IV_LENGTH);
      const tag = buffer.subarray(this.SALT_LENGTH + this.IV_LENGTH, this.SALT_LENGTH + this.IV_LENGTH + this.TAG_LENGTH);
      const encrypted = buffer.subarray(this.SALT_LENGTH + this.IV_LENGTH + this.TAG_LENGTH);

      const key = crypto.scryptSync(masterKey, salt, 32);
      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAuthTag(tag);

      return decipher.update(encrypted) + decipher.final('utf8');
    } catch (e) {
      console.error('[ENCRYPTED STORAGE ERROR] Decryption failed. Possible invalid master key.');
      return null;
    }
  }

  /**
   * Safe atomic write for encrypted files.
   */
  public static writeEncryptedFile(filePath: string, data: string, masterKey: string): void {
    const encryptedData = this.encrypt(data, masterKey);
    const tempPath = `${filePath}.enc.tmp`;
    fs.writeFileSync(tempPath, encryptedData, 'utf8');
    fs.renameSync(tempPath, filePath);
  }

  /**
   * Safe read for encrypted files.
   */
  public static readEncryptedFile(filePath: string, masterKey: string): string | null {
    if (!fs.existsSync(filePath)) return null;
    const cipherText = fs.readFileSync(filePath, 'utf8');
    return this.decrypt(cipherText, masterKey);
  }
}
