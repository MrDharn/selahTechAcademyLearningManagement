import { z } from 'zod';
import { prismaDatabaseClient } from '../database/prismaDatabaseClient';
import {
  createAuthorizedResourceDownloadUrl,
  createSignedLessonResourceUploadParameters,
  deleteLessonResourceFromCloudinary,
  getInstructorCloudinaryCredentials,
} from '../services/cloudinaryMultiAccountService';
import { assertUserCanManageLesson } from '../services/courseOwnershipService';
import { buildLessonResourceFolderPath, describeResourceFileProblem, findProblemWithResourceFile, isPublicIdInsideFolder } from '../rules/lessonResourceRules';
import { ApplicationError } from '../utilities/ApplicationError';
import { asyncRequestHandler } from '../utilities/asyncRequestHandler';

const registerResourceRequestSchema = z.object({
  cloudinaryPublicId: z.string().min(1).max(500),
  originalFileName: z.string().trim().min(1).max(200),
  displayName: z.string().trim().min(1).max(120),
  fileSizeInBytes: z.number().int().min(0),
});

const resourceForListing = (resource: { id: string; displayName: string; originalFileName: string; fileSizeInBytes: number; createdAt: Date }) => ({
  resourceId: resource.id,
  displayName: resource.displayName,
  originalFileName: resource.originalFileName,
  fileSizeInBytes: resource.fileSizeInBytes,
  createdAt: resource.createdAt,
});

// ---- Instructor / admin ----

export const listLessonResourcesForInstructor = asyncRequestHandler(async (request, response) => {
  await assertUserCanManageLesson(request.authenticatedUser!, request.params.lessonId);
  const resources = await prismaDatabaseClient.lessonResource.findMany({ where: { lessonId: request.params.lessonId }, orderBy: { createdAt: 'asc' } });
  response.json({ resources: resources.map(resourceForListing) });
});

export const createLessonResourceUploadSignature = asyncRequestHandler(async (request, response) => {
  const lesson = await assertUserCanManageLesson(request.authenticatedUser!, request.params.lessonId);
  const ownerCredentials = await getInstructorCloudinaryCredentials(lesson.courseModule.course.instructorUserId);
  response.json(createSignedLessonResourceUploadParameters(ownerCredentials, buildLessonResourceFolderPath(lesson.courseModule.courseId, lesson.id)));
});

export const registerUploadedLessonResource = asyncRequestHandler(async (request, response) => {
  const lesson = await assertUserCanManageLesson(request.authenticatedUser!, request.params.lessonId);
  const uploadedFile = registerResourceRequestSchema.parse(request.body);

  const problem = findProblemWithResourceFile(uploadedFile.originalFileName, uploadedFile.fileSizeInBytes);
  if (problem) throw new ApplicationError(400, describeResourceFileProblem(problem), 'RESOURCE_FILE_NOT_ALLOWED');

  if (!isPublicIdInsideFolder(uploadedFile.cloudinaryPublicId, buildLessonResourceFolderPath(lesson.courseModule.courseId, lesson.id))) {
    throw new ApplicationError(400, 'This file was not uploaded for this lesson.', 'RESOURCE_UPLOAD_LOCATION_INVALID');
  }

  const savedResource = await prismaDatabaseClient.lessonResource.create({ data: { lessonId: lesson.id, ...uploadedFile } });
  response.status(201).json({ resource: resourceForListing(savedResource) });
});

export const deleteLessonResource = asyncRequestHandler(async (request, response) => {
  const lesson = await assertUserCanManageLesson(request.authenticatedUser!, request.params.lessonId);
  const resource = await prismaDatabaseClient.lessonResource.findFirst({ where: { id: request.params.resourceId, lessonId: lesson.id } });
  if (!resource) throw new ApplicationError(404, 'File not found.', 'RESOURCE_NOT_FOUND');

  await prismaDatabaseClient.lessonResource.delete({ where: { id: resource.id } });
  const ownerCredentials = await getInstructorCloudinaryCredentials(lesson.courseModule.course.instructorUserId).catch(() => null);
  if (ownerCredentials) await deleteLessonResourceFromCloudinary(ownerCredentials, resource.cloudinaryPublicId);

  response.status(204).send();
});

// ---- Student (after the lesson access guards) ----

export const listLessonResourcesForStudent = asyncRequestHandler(async (request, response) => {
  const resources = await prismaDatabaseClient.lessonResource.findMany({ where: { lessonId: request.params.lessonId }, orderBy: { createdAt: 'asc' } });
  response.json({ resources: resources.map(resourceForListing) });
});

export const getLessonResourceDownloadLink = asyncRequestHandler(async (request, response) => {
  const resource = await prismaDatabaseClient.lessonResource.findFirst({
    where: { id: request.params.resourceId, lessonId: request.params.lessonId },
    include: { lesson: { select: { courseModule: { select: { course: { select: { instructorUserId: true } } } } } } },
  });
  if (!resource) throw new ApplicationError(404, 'File not found.', 'RESOURCE_NOT_FOUND');

  const ownerCredentials = await getInstructorCloudinaryCredentials(resource.lesson.courseModule.course.instructorUserId);
  response.json({ downloadUrl: createAuthorizedResourceDownloadUrl(ownerCredentials, resource.cloudinaryPublicId), fileName: resource.originalFileName });
});
