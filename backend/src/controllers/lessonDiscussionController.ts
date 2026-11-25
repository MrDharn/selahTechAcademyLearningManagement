import type { Request } from 'express';
import { z } from 'zod';
import { prismaDatabaseClient } from '../database/prismaDatabaseClient';
import { assertUserCanManageCourse } from '../services/courseOwnershipService';
import { formatReviewerDisplayName } from '../rules/courseRatingRules';
import {
  MAXIMUM_QUESTIONS_PER_STUDENT_PER_HOUR,
  isDiscussionTextAcceptable,
  normalizeDiscussionText,
  orderQuestionsForInstructor,
} from '../rules/lessonQuestionRules';
import { ApplicationError } from '../utilities/ApplicationError';
import { asyncRequestHandler } from '../utilities/asyncRequestHandler';

const discussionTextRequestSchema = z.object({ text: z.string() });

function parseDiscussionText(requestBody: unknown): string {
  const { text } = discussionTextRequestSchema.parse(requestBody);
  if (!isDiscussionTextAcceptable(text)) {
    throw new ApplicationError(400, 'Write between 3 and 1000 characters.', 'DISCUSSION_TEXT_INVALID');
  }
  return normalizeDiscussionText(text);
}

const questionInclude = {
  askedByUser: { select: { fullName: true, userRole: true } },
  answers: { orderBy: { createdAt: 'asc' as const }, include: { answeredByUser: { select: { fullName: true, userRole: true } } } },
};

type QuestionWithPeople = Awaited<ReturnType<typeof prismaDatabaseClient.lessonQuestion.findMany<{ include: typeof questionInclude }>>>[number];

function presentQuestion(question: QuestionWithPeople, viewerUserId: string, canModerate: boolean) {
  return {
    questionId: question.id,
    questionText: question.questionText,
    askedByDisplayName: formatReviewerDisplayName(question.askedByUser.fullName),
    createdAt: question.createdAt,
    canDelete: canModerate || question.askedByUserId === viewerUserId,
    answers: question.answers.map((answer) => ({
      answerId: answer.id,
      answerText: answer.answerText,
      // Staff answers are labelled "Instructor" so students know which replies are official.
      answeredByDisplayName: formatReviewerDisplayName(answer.answeredByUser.fullName),
      isFromInstructor: answer.answeredByUser.userRole !== 'STUDENT',
      createdAt: answer.createdAt,
    })),
  };
}

// ---- Student side (after the lesson access guards) ----

export const listLessonQuestions = asyncRequestHandler(async (request, response) => {
  const viewerUserId = request.authenticatedUser!.userId;
  const questions = await prismaDatabaseClient.lessonQuestion.findMany({
    where: { lessonId: request.params.lessonId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: questionInclude,
  });
  response.json({ questions: questions.map((question) => presentQuestion(question, viewerUserId, Boolean(request.lessonAccessContext?.isPrivilegedViewer))) });
});

export const askLessonQuestion = asyncRequestHandler(async (request, response) => {
  const askedByUserId = request.authenticatedUser!.userId;
  const questionText = parseDiscussionText(request.body);

  const questionsAskedInTheLastHour = await prismaDatabaseClient.lessonQuestion.count({
    where: { askedByUserId, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (questionsAskedInTheLastHour >= MAXIMUM_QUESTIONS_PER_STUDENT_PER_HOUR) {
    throw new ApplicationError(429, 'You have asked many questions in the last hour. Please try again a little later.', 'TOO_MANY_QUESTIONS');
  }

  const createdQuestion = await prismaDatabaseClient.lessonQuestion.create({
    data: { lessonId: request.params.lessonId, askedByUserId, questionText },
  });
  response.status(201).json({ questionId: createdQuestion.id });
});

export const deleteLessonQuestionFromLesson = asyncRequestHandler(async (request, response) => {
  const question = await prismaDatabaseClient.lessonQuestion.findFirst({ where: { id: request.params.questionId, lessonId: request.params.lessonId } });
  if (!question) throw new ApplicationError(404, 'Question not found.', 'QUESTION_NOT_FOUND');

  const isOwnQuestion = question.askedByUserId === request.authenticatedUser!.userId;
  if (!isOwnQuestion && !request.lessonAccessContext?.isPrivilegedViewer) {
    throw new ApplicationError(403, 'You can only delete your own questions.', 'NOT_QUESTION_OWNER');
  }
  await prismaDatabaseClient.lessonQuestion.delete({ where: { id: question.id } });
  response.status(204).send();
});

// ---- Instructor / admin side ----

export const listCourseQuestionsForInstructor = asyncRequestHandler(async (request, response) => {
  await assertUserCanManageCourse(request.authenticatedUser!, request.params.courseId);
  const questions = await prismaDatabaseClient.lessonQuestion.findMany({
    where: { lesson: { courseModule: { courseId: request.params.courseId } } },
    include: { ...questionInclude, lesson: { select: { title: true } } },
    take: 200,
    orderBy: { createdAt: 'desc' },
  });

  const questionsForDisplay = questions.map((question) => ({
    ...presentQuestion(question, request.authenticatedUser!.userId, true),
    lessonTitle: question.lesson.title,
    answerCount: question.answers.length,
    rawCreatedAt: question.createdAt,
  }));

  response.json({
    unansweredQuestionCount: questionsForDisplay.filter((question) => question.answerCount === 0).length,
    questions: orderQuestionsForInstructor(questionsForDisplay.map((question) => ({ ...question, createdAt: question.rawCreatedAt }))).map(
      ({ rawCreatedAt: _ignoredDuplicate, answerCount: _ignoredCount, ...question }) => question,
    ),
  });
});

async function loadQuestionAndAssertUserCanManageItsCourse(request: Request) {
  const question = await prismaDatabaseClient.lessonQuestion.findUnique({
    where: { id: request.params.questionId },
    include: { lesson: { select: { courseModule: { select: { courseId: true } } } } },
  });
  if (!question) throw new ApplicationError(404, 'Question not found.', 'QUESTION_NOT_FOUND');
  await assertUserCanManageCourse(request.authenticatedUser!, question.lesson.courseModule.courseId);
  return question;
}

export const answerLessonQuestion = asyncRequestHandler(async (request, response) => {
  const question = await loadQuestionAndAssertUserCanManageItsCourse(request);
  const answerText = parseDiscussionText(request.body);
  const createdAnswer = await prismaDatabaseClient.lessonAnswer.create({
    data: { questionId: question.id, answeredByUserId: request.authenticatedUser!.userId, answerText },
  });
  response.status(201).json({ answerId: createdAnswer.id });
});

export const deleteLessonQuestionAsInstructor = asyncRequestHandler(async (request, response) => {
  const question = await loadQuestionAndAssertUserCanManageItsCourse(request);
  await prismaDatabaseClient.lessonQuestion.delete({ where: { id: question.id } });
  response.status(204).send();
});
