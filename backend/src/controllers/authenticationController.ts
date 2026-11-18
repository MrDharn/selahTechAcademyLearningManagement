import { z } from 'zod';
import { prismaDatabaseClient } from '../database/prismaDatabaseClient';
import { ApplicationError } from '../utilities/ApplicationError';
import { asyncRequestHandler } from '../utilities/asyncRequestHandler';
import { createAuthenticationToken } from '../utilities/jsonWebTokenUtilities';
import { doesPlainTextPasswordMatchHash, hashPlainTextPassword } from '../utilities/passwordHashingUtilities';
import { toPublicUserRepresentation } from '../utilities/publicUserRepresentation';

const studentRegistrationRequestSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters'),
  emailAddress: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const loginRequestSchema = z.object({
  emailAddress: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
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

  response.status(201).json({ authenticationToken, user: toPublicUserRepresentation(createdStudentUser) });
});

export const loginUser = asyncRequestHandler(async (request, response) => {
  const loginDetails = loginRequestSchema.parse(request.body);

  const matchingUser = await prismaDatabaseClient.user.findUnique({ where: { emailAddress: loginDetails.emailAddress } });

  const isPasswordCorrect = matchingUser
    ? await doesPlainTextPasswordMatchHash(loginDetails.password, matchingUser.hashedPassword)
    : false;

  if (!matchingUser || !isPasswordCorrect) {
    throw new ApplicationError(401, 'Incorrect email address or password.', 'INVALID_CREDENTIALS');
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
