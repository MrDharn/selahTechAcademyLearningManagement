import { OAuth2Client } from 'google-auth-library';
import { environmentConfiguration } from '../configuration/environmentConfiguration';
import { ApplicationError } from '../utilities/ApplicationError';

export interface VerifiedGoogleIdentity {
  googleSubjectId: string;
  emailAddress: string;
  fullName: string;
}

let cachedGoogleOAuthClient: OAuth2Client | null = null;

/**
 * Checks the ID token's signature (Google's public keys), expiry, issuer and that it was issued for OUR client ID,
 * then only accepts it when Google says the e-mail address is verified.
 */
export async function verifyGoogleIdentityToken(googleIdToken: string): Promise<VerifiedGoogleIdentity> {
  const googleClientId = environmentConfiguration.googleClientId;
  if (!googleClientId) {
    throw new ApplicationError(503, 'Google sign-in is not set up on this server.', 'GOOGLE_SIGN_IN_NOT_CONFIGURED');
  }

  cachedGoogleOAuthClient ??= new OAuth2Client(googleClientId);

  let tokenPayload;
  try {
    const verifiedLoginTicket = await cachedGoogleOAuthClient.verifyIdToken({ idToken: googleIdToken, audience: googleClientId });
    tokenPayload = verifiedLoginTicket.getPayload();
  } catch {
    throw new ApplicationError(401, 'Google sign-in could not be verified. Please try again.', 'INVALID_GOOGLE_TOKEN');
  }

  if (!tokenPayload?.sub || !tokenPayload.email) {
    throw new ApplicationError(401, 'Google did not return an e-mail address for this account.', 'INVALID_GOOGLE_TOKEN');
  }
  if (!tokenPayload.email_verified) {
    throw new ApplicationError(403, 'Your Google e-mail address is not verified.', 'GOOGLE_EMAIL_NOT_VERIFIED');
  }

  const emailAddress = tokenPayload.email.toLowerCase();
  return {
    googleSubjectId: tokenPayload.sub,
    emailAddress,
    fullName: tokenPayload.name?.trim() || emailAddress.split('@')[0],
  };
}
