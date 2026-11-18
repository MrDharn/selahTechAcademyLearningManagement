import { z } from 'zod';
import { prismaDatabaseClient } from '../database/prismaDatabaseClient';
import {
  assertCloudinaryCredentialsAreValid,
  createSignedCourseThumbnailUploadParameters,
  createSignedVideoUploadParameters,
  getInstructorCloudinaryCredentials,
  isImageUrlHostedOnCloudinaryAccount,
} from '../services/cloudinaryMultiAccountService';
import { assertUserCanManageCourse, assertUserCanManageLesson } from '../services/courseOwnershipService';
import { ApplicationError } from '../utilities/ApplicationError';
import { asyncRequestHandler } from '../utilities/asyncRequestHandler';
import { encryptSensitiveText } from '../utilities/credentialEncryptionUtilities';

const saveCloudinaryAccountRequestSchema = z.object({
  cloudinaryCloudName: z.string().trim().min(1),
  cloudinaryApiKey: z.string().trim().min(1),
  cloudinaryApiSecret: z.string().trim().min(1),
});

const attachUploadedVideoRequestSchema = z.object({
  cloudinaryVideoPublicId: z.string().trim().min(1),
  videoDurationInSeconds: z.number().int().min(0).nullable().optional(),
});

const saveCourseThumbnailRequestSchema = z.object({ thumbnailImageUrl: z.string().url() });

/** Never returns the API secret - only whether an account is connected and which one. */
export const getMyCloudinaryAccountSummary = asyncRequestHandler(async (request, response) => {
  const storedCloudinaryAccount = await prismaDatabaseClient.instructorCloudinaryAccount.findUnique({
    where: { instructorUserId: request.authenticatedUser!.userId },
  });

  response.json({
    isCloudinaryAccountConnected: storedCloudinaryAccount !== null,
    cloudinaryCloudName: storedCloudinaryAccount?.cloudinaryCloudName ?? null,
    cloudinaryApiKey: storedCloudinaryAccount?.cloudinaryApiKey ?? null,
  });
});

export const saveMyCloudinaryAccount = asyncRequestHandler(async (request, response) => {
  const submittedCredentials = saveCloudinaryAccountRequestSchema.parse(request.body);

  await assertCloudinaryCredentialsAreValid(submittedCredentials);

  await prismaDatabaseClient.instructorCloudinaryAccount.upsert({
    where: { instructorUserId: request.authenticatedUser!.userId },
    create: {
      instructorUserId: request.authenticatedUser!.userId,
      cloudinaryCloudName: submittedCredentials.cloudinaryCloudName,
      cloudinaryApiKey: submittedCredentials.cloudinaryApiKey,
      encryptedCloudinaryApiSecret: encryptSensitiveText(submittedCredentials.cloudinaryApiSecret),
    },
    update: {
      cloudinaryCloudName: submittedCredentials.cloudinaryCloudName,
      cloudinaryApiKey: submittedCredentials.cloudinaryApiKey,
      encryptedCloudinaryApiSecret: encryptSensitiveText(submittedCredentials.cloudinaryApiSecret),
    },
  });

  response.json({ isCloudinaryAccountConnected: true, cloudinaryCloudName: submittedCredentials.cloudinaryCloudName });
});

/** Uses the credentials of the COURSE OWNER, so an admin uploading for an instructor still lands in the right account. */
export const createLessonVideoUploadSignature = asyncRequestHandler(async (request, response) => {
  const lessonToReceiveVideo = await assertUserCanManageLesson(request.authenticatedUser!, request.params.lessonId);
  const courseOwnerCredentials = await getInstructorCloudinaryCredentials(lessonToReceiveVideo.courseModule.course.instructorUserId);

  const signedUploadParameters = createSignedVideoUploadParameters(
    courseOwnerCredentials,
    `selahtech-academy/courses/${lessonToReceiveVideo.courseModule.courseId}/lessons/${lessonToReceiveVideo.id}`,
  );

  response.json(signedUploadParameters);
});

export const attachUploadedVideoToLesson = asyncRequestHandler(async (request, response) => {
  await assertUserCanManageLesson(request.authenticatedUser!, request.params.lessonId);
  const uploadedVideoDetails = attachUploadedVideoRequestSchema.parse(request.body);

  const updatedLesson = await prismaDatabaseClient.lesson.update({
    where: { id: request.params.lessonId },
    data: {
      cloudinaryVideoPublicId: uploadedVideoDetails.cloudinaryVideoPublicId,
      videoDurationInSeconds: uploadedVideoDetails.videoDurationInSeconds ?? null,
    },
  });

  response.json({ lesson: updatedLesson });
});

/** Cover image for a course: the instructor picks a file, the browser uploads it to THEIR Cloudinary with this signed ticket. */
export const createCourseThumbnailUploadSignature = asyncRequestHandler(async (request, response) => {
  const courseToReceiveThumbnail = await assertUserCanManageCourse(request.authenticatedUser!, request.params.courseId);
  const courseOwnerCredentials = await getInstructorCloudinaryCredentials(courseToReceiveThumbnail.instructorUserId);

  response.json(
    createSignedCourseThumbnailUploadParameters(courseOwnerCredentials, `selahtech-academy/courses/${courseToReceiveThumbnail.id}`),
  );
});

export const saveCourseThumbnail = asyncRequestHandler(async (request, response) => {
  const courseToUpdate = await assertUserCanManageCourse(request.authenticatedUser!, request.params.courseId);
  const { thumbnailImageUrl } = saveCourseThumbnailRequestSchema.parse(request.body);

  const courseOwnerCredentials = await getInstructorCloudinaryCredentials(courseToUpdate.instructorUserId);
  if (!isImageUrlHostedOnCloudinaryAccount(thumbnailImageUrl, courseOwnerCredentials.cloudinaryCloudName)) {
    throw new ApplicationError(400, 'The cover image must be uploaded to your connected Cloudinary account.', 'THUMBNAIL_URL_NOT_ALLOWED');
  }

  const updatedCourse = await prismaDatabaseClient.course.update({ where: { id: courseToUpdate.id }, data: { thumbnailImageUrl } });
  response.json({ thumbnailImageUrl: updatedCourse.thumbnailImageUrl });
});

export const removeCourseThumbnail = asyncRequestHandler(async (request, response) => {
  const courseToUpdate = await assertUserCanManageCourse(request.authenticatedUser!, request.params.courseId);
  await prismaDatabaseClient.course.update({ where: { id: courseToUpdate.id }, data: { thumbnailImageUrl: null } });
  response.status(204).send();
});
