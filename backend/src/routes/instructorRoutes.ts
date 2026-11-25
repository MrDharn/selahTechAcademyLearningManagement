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
  deleteDraftCourse,
  deleteLesson,
  getCourseForEditing,
  listCoursesManagedByCurrentUser,
  updateCourse,
  updateCourseModule,
  updateLesson,
} from '../controllers/courseManagementController';
import {
  answerLessonQuestion,
  deleteLessonQuestionAsInstructor,
  listCourseQuestionsForInstructor,
} from '../controllers/lessonDiscussionController';
import {
  createLessonResourceUploadSignature,
  deleteLessonResource,
  listLessonResourcesForInstructor,
  registerUploadedLessonResource,
} from '../controllers/lessonResourceController';
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
instructorRoutes.delete('/courses/:courseId', deleteDraftCourse);

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

// Lesson files (direct browser -> the course owner's Cloudinary, stored privately)
instructorRoutes.get('/lessons/:lessonId/resources', listLessonResourcesForInstructor);
instructorRoutes.post('/lessons/:lessonId/resources/upload-signature', createLessonResourceUploadSignature);
instructorRoutes.post('/lessons/:lessonId/resources', registerUploadedLessonResource);
instructorRoutes.delete('/lessons/:lessonId/resources/:resourceId', deleteLessonResource);

// Student questions
instructorRoutes.get('/courses/:courseId/questions', listCourseQuestionsForInstructor);
instructorRoutes.post('/questions/:questionId/answers', answerLessonQuestion);
instructorRoutes.delete('/questions/:questionId', deleteLessonQuestionAsInstructor);

// Assessments
instructorRoutes.get('/lessons/:lessonId/assessment', getLessonAssessmentForInstructor);
instructorRoutes.put('/lessons/:lessonId/assessment', saveLessonAssessment);
instructorRoutes.delete('/lessons/:lessonId/assessment', deleteLessonAssessment);
