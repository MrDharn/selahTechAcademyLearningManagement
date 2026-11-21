import { createHash, randomBytes } from 'crypto';
import { environmentConfiguration } from '../configuration/environmentConfiguration';
import { prismaDatabaseClient } from '../database/prismaDatabaseClient';
import { ApplicationError } from '../utilities/ApplicationError';
import { hashPlainTextPassword } from '../utilities/passwordHashingUtilities';
import { sendEmail } from './emailDeliveryService';
import { buildPasswordResetEmail } from './emailTemplates';

export const PASSWORD_RESET_LINK_VALID_FOR_MINUTES = 60;

function hashPasswordResetToken(plainPasswordResetToken: string): string {
  return createHash('sha256').update(plainPasswordResetToken).digest('hex');
}

/**
 * Sends a reset link when the e-mail address belongs to an active account. It returns nothing either way,
 * so the page can never be used to find out which e-mail addresses are registered.
 */
export async function sendPasswordResetLinkIfAccountExists(emailAddress: string): Promise<void> {
  const matchingUser = await prismaDatabaseClient.user.findUnique({ where: { emailAddress } });
  if (!matchingUser || !matchingUser.isAccountActive) return;

  const plainPasswordResetToken = randomBytes(32).toString('hex');

  // Only the newest link works: older unused links for this account are removed first.
  await prismaDatabaseClient.$transaction([
    prismaDatabaseClient.passwordResetToken.deleteMany({ where: { userId: matchingUser.id, usedAt: null } }),
    prismaDatabaseClient.passwordResetToken.create({
      data: {
        userId: matchingUser.id,
        hashedToken: hashPasswordResetToken(plainPasswordResetToken),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_LINK_VALID_FOR_MINUTES * 60 * 1000),
      },
    }),
  ]);

  await sendEmail(
    buildPasswordResetEmail({
      recipientEmailAddress: matchingUser.emailAddress,
      fullName: matchingUser.fullName,
      passwordResetPageUrl: `${environmentConfiguration.frontendBaseUrl}/reset-password?token=${plainPasswordResetToken}`,
      linkValidForMinutes: PASSWORD_RESET_LINK_VALID_FOR_MINUTES,
    }),
  );
}

/** Also works for accounts created with Google: it gives them a password they can use next to Google sign-in. */
export async function resetPasswordWithToken(plainPasswordResetToken: string, newPlainTextPassword: string): Promise<void> {
  const matchingToken = await prismaDatabaseClient.passwordResetToken.findUnique({
    where: { hashedToken: hashPasswordResetToken(plainPasswordResetToken) },
  });

  if (!matchingToken || matchingToken.usedAt || matchingToken.expiresAt < new Date()) {
    throw new ApplicationError(400, 'This reset link is invalid or has expired. Please request a new one.', 'PASSWORD_RESET_LINK_INVALID');
  }

  // Marking the token as used is the guard: if two requests race, only one of them updates a row.
  const newHashedPassword = await hashPlainTextPassword(newPlainTextPassword);
  await prismaDatabaseClient.$transaction(async (databaseTransactionClient) => {
    const tokenClaim = await databaseTransactionClient.passwordResetToken.updateMany({
      where: { id: matchingToken.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (tokenClaim.count !== 1) {
      throw new ApplicationError(400, 'This reset link is invalid or has expired. Please request a new one.', 'PASSWORD_RESET_LINK_INVALID');
    }
    await databaseTransactionClient.user.update({ where: { id: matchingToken.userId }, data: { hashedPassword: newHashedPassword } });
  });
}

export async function deleteExpiredPasswordResetTokens(): Promise<number> {
  const deletion = await prismaDatabaseClient.passwordResetToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return deletion.count;
}
