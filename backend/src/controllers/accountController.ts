import { z } from 'zod';
import { prismaDatabaseClient } from '../database/prismaDatabaseClient';
import { determineCourseAccessStatus } from '../services/enrollmentAccessService';
import { ApplicationError } from '../utilities/ApplicationError';
import { asyncRequestHandler } from '../utilities/asyncRequestHandler';
import { doesPlainTextPasswordMatchHash, hashPlainTextPassword } from '../utilities/passwordHashingUtilities';
import { toPublicUserRepresentation } from '../utilities/publicUserRepresentation';

/** The browser shrinks pictures to about 256 px first, so a real one is far below this limit. */
const MAXIMUM_PROFILE_PICTURE_DATA_URL_LENGTH = 200_000;

const profileUpdateRequestSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100).optional(),
  // Empty text clears the number. Spaces and dashes are removed, so "+234 801-234-5678" is stored as "+2348012345678".
  phoneNumber: z
    .string()
    .trim()
    .transform((typedPhoneNumber) => typedPhoneNumber.replace(/[\s-]/g, ''))
    .refine((normalizedPhoneNumber) => normalizedPhoneNumber === '' || /^\+?[0-9]{7,15}$/.test(normalizedPhoneNumber), 'Enter a valid phone number, for example +2348012345678')
    .optional(),
});

const profilePictureRequestSchema = z.object({
  profilePictureDataUrl: z
    .string()
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, 'The picture must be a JPEG, PNG or WebP image')
    .max(MAXIMUM_PROFILE_PICTURE_DATA_URL_LENGTH, 'The picture is too large'),
});

const passwordChangeRequestSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, 'The new password must be at least 8 characters'),
});

/** Everything the settings page needs: profile, whether a password exists, and the courses the user is enrolled in. */
export const getMyAccount = asyncRequestHandler(async (request, response) => {
  const authenticatedUserId = request.authenticatedUser!.userId;

  const [accountOwner, enrollments] = await Promise.all([
    prismaDatabaseClient.user.findUniqueOrThrow({ where: { id: authenticatedUserId } }),
    prismaDatabaseClient.enrollment.findMany({
      where: { studentUserId: authenticatedUserId },
      orderBy: { enrolledAt: 'desc' },
      include: { course: { select: { id: true, title: true, thumbnailImageUrl: true } } },
    }),
  ]);

  response.json({
    user: toPublicUserRepresentation(accountOwner),
    hasPassword: accountOwner.hashedPassword !== null,
    enrolledCourses: enrollments.map((enrollment) => ({
      courseId: enrollment.course.id,
      courseTitle: enrollment.course.title,
      thumbnailImageUrl: enrollment.course.thumbnailImageUrl,
      enrollmentType: enrollment.enrollmentType,
      enrolledAt: enrollment.enrolledAt,
      accessExpiresAt: enrollment.accessExpiresAt,
      gracePeriodEndsAt: enrollment.gracePeriodEndsAt,
      courseAccessStatus: determineCourseAccessStatus(enrollment),
    })),
  });
});

export const updateMyProfile = asyncRequestHandler(async (request, response) => {
  const profileChanges = profileUpdateRequestSchema.parse(request.body);

  const updatedUser = await prismaDatabaseClient.user.update({
    where: { id: request.authenticatedUser!.userId },
    data: {
      ...(profileChanges.fullName !== undefined ? { fullName: profileChanges.fullName } : {}),
      ...(profileChanges.phoneNumber !== undefined ? { phoneNumber: profileChanges.phoneNumber === '' ? null : profileChanges.phoneNumber } : {}),
    },
  });

  response.json({ user: toPublicUserRepresentation(updatedUser) });
});

export const setMyProfilePicture = asyncRequestHandler(async (request, response) => {
  const { profilePictureDataUrl } = profilePictureRequestSchema.parse(request.body);

  const updatedUser = await prismaDatabaseClient.user.update({
    where: { id: request.authenticatedUser!.userId },
    data: { profilePictureDataUrl },
  });

  response.json({ user: toPublicUserRepresentation(updatedUser) });
});

export const removeMyProfilePicture = asyncRequestHandler(async (request, response) => {
  const updatedUser = await prismaDatabaseClient.user.update({
    where: { id: request.authenticatedUser!.userId },
    data: { profilePictureDataUrl: null },
  });

  response.json({ user: toPublicUserRepresentation(updatedUser) });
});

/** An account made with Google has no password yet, so it may set one without a current password. */
export const changeMyPassword = asyncRequestHandler(async (request, response) => {
  const { currentPassword, newPassword } = passwordChangeRequestSchema.parse(request.body);

  const accountOwner = await prismaDatabaseClient.user.findUniqueOrThrow({ where: { id: request.authenticatedUser!.userId } });

  if (accountOwner.hashedPassword) {
    const isCurrentPasswordCorrect = currentPassword ? await doesPlainTextPasswordMatchHash(currentPassword, accountOwner.hashedPassword) : false;
    if (!isCurrentPasswordCorrect) {
      throw new ApplicationError(400, 'Your current password is not correct.', 'CURRENT_PASSWORD_INCORRECT');
    }
  }

  await prismaDatabaseClient.user.update({
    where: { id: accountOwner.id },
    data: { hashedPassword: await hashPlainTextPassword(newPassword) },
  });

  response.json({ message: 'Your password has been changed.' });
});
