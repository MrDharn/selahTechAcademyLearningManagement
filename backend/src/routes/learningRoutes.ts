import { Router } from 'express';
import {
  getLessonAssessmentForStudent,
  submitAssessmentAttempt,
} from '../controllers/assessmentController';
import { downloadCertificatePdf, listMyCertificates } from '../controllers/certificateController';
import {
  getAuthorizedLessonStream,
  getCourseProgress,
  markLessonAsCompleted,
  saveLessonWatchPosition,
} from '../controllers/learningController';
import { askLessonQuestion, deleteLessonQuestionFromLesson, listLessonQuestions } from '../controllers/lessonDiscussionController';
import { getLessonResourceDownloadLink, listLessonResourcesForStudent } from '../controllers/lessonResourceController';
import { requireAuthentication } from '../middleware/authenticationMiddleware';
import { requireActiveCourseAccessForLesson, requireLessonToBeUnlocked } from '../middleware/courseAccessExpiryGuardMiddleware';

export const learningRoutes = Router();

learningRoutes.use(requireAuthentication);

learningRoutes.get('/courses/:courseId/progress', getCourseProgress);

// Every lesson route runs: JWT -> Access Expiry Guard -> sequential unlock check -> controller.
const lessonAccessGuards = [requireActiveCourseAccessForLesson, requireLessonToBeUnlocked];

learningRoutes.get('/lessons/:lessonId/stream', ...lessonAccessGuards, getAuthorizedLessonStream);
learningRoutes.put('/lessons/:lessonId/watch-position', ...lessonAccessGuards, saveLessonWatchPosition);
learningRoutes.post('/lessons/:lessonId/complete', ...lessonAccessGuards, markLessonAsCompleted);
learningRoutes.get('/lessons/:lessonId/assessment', ...lessonAccessGuards, getLessonAssessmentForStudent);
learningRoutes.post('/lessons/:lessonId/assessment/attempts', ...lessonAccessGuards, submitAssessmentAttempt);

learningRoutes.get('/lessons/:lessonId/resources', ...lessonAccessGuards, listLessonResourcesForStudent);
learningRoutes.get('/lessons/:lessonId/resources/:resourceId/download', ...lessonAccessGuards, getLessonResourceDownloadLink);

learningRoutes.get('/lessons/:lessonId/questions', ...lessonAccessGuards, listLessonQuestions);
learningRoutes.post('/lessons/:lessonId/questions', ...lessonAccessGuards, askLessonQuestion);
learningRoutes.delete('/lessons/:lessonId/questions/:questionId', ...lessonAccessGuards, deleteLessonQuestionFromLesson);

learningRoutes.get('/certificates/me', listMyCertificates);
learningRoutes.get('/certificates/courses/:courseId/download', downloadCertificatePdf);
