import bcrypt from 'bcryptjs';

const PASSWORD_HASHING_SALT_ROUNDS = 12;

export function hashPlainTextPassword(plainTextPassword: string): Promise<string> {
  return bcrypt.hash(plainTextPassword, PASSWORD_HASHING_SALT_ROUNDS);
}

export function doesPlainTextPasswordMatchHash(plainTextPassword: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(plainTextPassword, hashedPassword);
}
