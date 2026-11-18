import { Router } from 'express';
import {
  deleteLessonAssessment,
  getLessonAssessmentForInstructor,
  saveLessonAssessment,
} from '../controllers/assessmentController';
import {
  attachUploadedVideoToLesson,
  createCourseThumbnailUploadSignature,
  createLessonVideoUploadSignature,
  getMyCloudinaryAccountSummary,
  removeCourseThumbnail,
  saveCourseThumbnail,
  saveMyCloudinaryAccount,
} from '../controllers/cloudinaryIntegrationController';
import {
  createCourse,
  createCourseModule,
  createLesson,
  deleteCourseModule,
  deleteLesson,
  getCourseForEditing,
  listCoursesManagedByCurrentUser,
  updateCourse,
  updateCourseModule,
  updateLesson,
} from '../controllers/courseManagementController';
import { requireAuthentication } from '../middleware/authenticationMiddleware';
import { requireUserRole } from '../middleware/roleBasedAccessControlMiddleware';

export const instructorRoutes = Router();

instructorRoutes.use(requireAuthentication, requireUserRole('INSTRUCTOR', 'ADMIN'));

// Cloudinary account (one per instructor)
instructorRoutes.get('/cloudinary-account', getMyCloudinaryAccountSummary);
instructorRoutes.put('/cloudinary-account', requireUserRole('INSTRUCTOR'), saveMyCloudinaryAccount);

// Courses
instructorRoutes.get('/courses', listCoursesManagedByCurrentUser);
instructorRoutes.post('/courses', createCourse);
instructorRoutes.get('/courses/:courseId', getCourseForEditing);
instructorRoutes.patch('/courses/:courseId', updateCourse);

// Course cover image (direct browser -> the course owner's Cloudinary)
instructorRoutes.post('/courses/:courseId/thumbnail-upload-signature', createCourseThumbnailUploadSignature);
instructorRoutes.put('/courses/:courseId/thumbnail', saveCourseThumbnail);
instructorRoutes.delete('/courses/:courseId/thumbnail', removeCourseThumbnail);

// Modules
instructorRoutes.post('/courses/:courseId/modules', createCourseModule);
instructorRoutes.patch('/modules/:courseModuleId', updateCourseModule);
instructorRoutes.delete('/modules/:courseModuleId', deleteCourseModule);

// Lessons
instructorRoutes.post('/modules/:courseModuleId/lessons', createLesson);
instructorRoutes.patch('/lessons/:lessonId', updateLesson);
instructorRoutes.delete('/lessons/:lessonId', deleteLesson);

// Lesson video (direct browser -> Cloudinary upload using a signature from us)
instructorRoutes.post('/lessons/:lessonId/video-upload-signature', createLessonVideoUploadSignature);
instructorRoutes.put('/lessons/:lessonId/video', attachUploadedVideoToLesson);

// Assessments
instructorRoutes.get('/lessons/:lessonId/assessment', getLessonAssessmentForInstructor);
instructorRoutes.put('/lessons/:lessonId/assessment', saveLessonAssessment);
instructorRoutes.delete('/lessons/:lessonId/assessment', deleteLessonAssessment);
