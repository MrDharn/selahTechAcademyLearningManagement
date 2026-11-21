import { z } from 'zod';
import { prismaDatabaseClient } from '../database/prismaDatabaseClient';
import { ApplicationError } from '../utilities/ApplicationError';
import { asyncRequestHandler } from '../utilities/asyncRequestHandler';
import { createAuthenticationToken } from '../utilities/jsonWebTokenUtilities';
import { doesPlainTextPasswordMatchHash, hashPlainTextPassword } from '../utilities/passwordHashingUtilities';
import { toPublicUserRepresentation } from '../utilities/publicUserRepresentation';
import { environmentConfiguration } from '../configuration/environmentConfiguration';
import { verifyGoogleIdentityToken } from '../services/googleAuthenticationService';
import { resetPasswordWithToken, sendPasswordResetLinkIfAccountExists } from '../services/passwordResetService';
import { notifyStudentOfSuccessfulRegistration } from '../services/studentNotificationService';

const studentRegistrationRequestSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters'),
  emailAddress: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const loginRequestSchema = z.object({
  emailAddress: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

const forgotPasswordRequestSchema = z.object({ emailAddress: z.string().trim().toLowerCase().email('Enter a valid email address') });
const resetPasswordRequestSchema = z.object({
  passwordResetToken: z.string().min(20),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

/** Always answers the same way, whether or not the e-mail address is registered. */
export const requestPasswordResetLink = asyncRequestHandler(async (request, response) => {
  const { emailAddress } = forgotPasswordRequestSchema.parse(request.body);
  await sendPasswordResetLinkIfAccountExists(emailAddress);
  response.json({ message: 'If an account exists for that e-mail address, a reset link is on its way.' });
});

export const resetPassword = asyncRequestHandler(async (request, response) => {
  const { passwordResetToken, newPassword } = resetPasswordRequestSchema.parse(request.body);
  await resetPasswordWithToken(passwordResetToken, newPassword);
  response.json({ message: 'Your password has been changed. You can now sign in.' });
});

/** Public sign-up always creates a STUDENT. Instructors are created by an administrator. */
export const registerStudentAccount = asyncRequestHandler(async (request, response) => {
  const registrationDetails = studentRegistrationRequestSchema.parse(request.body);

  const userWithSameEmailAddress = await prismaDatabaseClient.user.findUnique({
    where: { emailAddress: registrationDetails.emailAddress },
  });
  if (userWithSameEmailAddress) {
    throw new ApplicationError(409, 'An account with this email address already exists.', 'EMAIL_ALREADY_REGISTERED');
  }

  const createdStudentUser = await prismaDatabaseClient.user.create({
    data: {
      fullName: registrationDetails.fullName,
      emailAddress: registrationDetails.emailAddress,
      hashedPassword: await hashPlainTextPassword(registrationDetails.password),
      userRole: 'STUDENT',
    },
  });

  const authenticationToken = createAuthenticationToken({
    userId: createdStudentUser.id,
    userRole: createdStudentUser.userRole,
    emailAddress: createdStudentUser.emailAddress,
  });

  // Not awaited on purpose: the student should not wait for the mail server, and a mail problem must not undo the registration.
  void notifyStudentOfSuccessfulRegistration(createdStudentUser);

  response.status(201).json({ authenticationToken, user: toPublicUserRepresentation(createdStudentUser) });
});

export const loginUser = asyncRequestHandler(async (request, response) => {
  const loginDetails = loginRequestSchema.parse(request.body);

  const matchingUser = await prismaDatabaseClient.user.findUnique({ where: { emailAddress: loginDetails.emailAddress } });

  // A Google-only account has no password hash, so it can never match a typed password.
  const isPasswordCorrect =
    matchingUser?.hashedPassword ? await doesPlainTextPasswordMatchHash(loginDetails.password, matchingUser.hashedPassword) : false;

  if (!matchingUser || !isPasswordCorrect) {
    throw new ApplicationError(
      401,
      'Incorrect email address or password. If you registered with Google, use the "Continue with Google" button.',
      'INVALID_CREDENTIALS',
    );
  }

  if (!matchingUser.isAccountActive) {
    throw new ApplicationError(403, 'This account has been deactivated. Contact support.', 'ACCOUNT_DEACTIVATED');
  }

  const authenticationToken = createAuthenticationToken({
    userId: matchingUser.id,
    userRole: matchingUser.userRole,
    emailAddress: matchingUser.emailAddress,
  });

  response.json({ authenticationToken, user: toPublicUserRepresentation(matchingUser) });
});

export const getCurrentlySignedInUser = asyncRequestHandler(async (request, response) => {
  const signedInUser = await prismaDatabaseClient.user.findUniqueOrThrow({
    where: { id: request.authenticatedUser!.userId },
  });

  response.json({ user: toPublicUserRepresentation(signedInUser) });
});

const googleSignInRequestSchema = z.object({ googleIdToken: z.string().min(20) });

/** Lets the frontend know whether to show the Google button, and which client ID to start it with. The client ID is public by design. */
export const getGoogleSignInConfiguration = asyncRequestHandler(async (_request, response) => {
  response.json({
    isGoogleSignInEnabled: Boolean(environmentConfiguration.googleClientId),
    googleClientId: environmentConfiguration.googleClientId ?? null,
  });
});

/**
 * "Continue with Google": the browser sends the ID token Google gave it; we verify the signature, audience and expiry
 * with Google's public keys, then sign the person in - creating a STUDENT account the first time, or linking Google to an
 * existing account that has the same verified e-mail address.
 */
export const signInWithGoogle = asyncRequestHandler(async (request, response) => {
  const { googleIdToken } = googleSignInRequestSchema.parse(request.body);
  const verifiedGoogleIdentity = await verifyGoogleIdentityToken(googleIdToken);

  let signedInUser = await prismaDatabaseClient.user.findUnique({ where: { googleSubjectId: verifiedGoogleIdentity.googleSubjectId } });
  let isNewAccount = false;

  if (!signedInUser) {
    const existingUserWithSameEmailAddress = await prismaDatabaseClient.user.findUnique({
      where: { emailAddress: verifiedGoogleIdentity.emailAddress },
    });

    if (existingUserWithSameEmailAddress) {
      // Google has verified this e-mail address, so it is safe to attach this Google identity to the existing account.
      signedInUser = await prismaDatabaseClient.user.update({
        where: { id: existingUserWithSameEmailAddress.id },
        data: { googleSubjectId: verifiedGoogleIdentity.googleSubjectId },
      });
    } else {
      signedInUser = await prismaDatabaseClient.user.create({
        data: {
          fullName: verifiedGoogleIdentity.fullName,
          emailAddress: verifiedGoogleIdentity.emailAddress,
          googleSubjectId: verifiedGoogleIdentity.googleSubjectId,
          userRole: 'STUDENT',
        },
      });
      isNewAccount = true;
    }
  }

  if (!signedInUser.isAccountActive) {
    throw new ApplicationError(403, 'This account has been deactivated. Contact support.', 'ACCOUNT_DEACTIVATED');
  }

  if (isNewAccount) void notifyStudentOfSuccessfulRegistration(signedInUser);

  const authenticationToken = createAuthenticationToken({
    userId: signedInUser.id,
    userRole: signedInUser.userRole,
    emailAddress: signedInUser.emailAddress,
  });

  response.status(isNewAccount ? 201 : 200).json({ authenticationToken, user: toPublicUserRepresentation(signedInUser), isNewAccount });
});
