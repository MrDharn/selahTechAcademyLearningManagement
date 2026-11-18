import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { environmentConfiguration } from '../configuration/environmentConfiguration';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const INITIALIZATION_VECTOR_LENGTH_IN_BYTES = 12;

const encryptionKeyBuffer = Buffer.from(environmentConfiguration.cloudinaryCredentialsEncryptionKeyAsHexadecimal, 'hex');

/** Output format: <iv hex>:<auth tag hex>:<cipher text hex> */
export function encryptSensitiveText(plainText: string): string {
  const initializationVector = randomBytes(INITIALIZATION_VECTOR_LENGTH_IN_BYTES);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, encryptionKeyBuffer, initializationVector);
  const encryptedBuffer = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authenticationTag = cipher.getAuthTag();

  return [initializationVector.toString('hex'), authenticationTag.toString('hex'), encryptedBuffer.toString('hex')].join(':');
}

export function decryptSensitiveText(encryptedText: string): string {
  const [initializationVectorHex, authenticationTagHex, encryptedHex] = encryptedText.split(':');
  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, encryptionKeyBuffer, Buffer.from(initializationVectorHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authenticationTagHex, 'hex'));
  const decryptedBuffer = Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]);

  return decryptedBuffer.toString('utf8');
}
