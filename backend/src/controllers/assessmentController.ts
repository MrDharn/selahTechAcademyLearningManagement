import { z } from 'zod';
import { prismaDatabaseClient } from '../database/prismaDatabaseClient';
import { issueCertificateIfStudentHasCompletedCourse } from '../services/certificateService';
import { assertUserCanManageLesson } from '../services/courseOwnershipService';
import { buildStudentCourseProgress, markLessonAsCompletedForStudent } from '../services/courseProgressService';
import { ApplicationError } from '../utilities/ApplicationError';
import { asyncRequestHandler } from '../utilities/asyncRequestHandler';

const assessmentDefinitionRequestSchema = z.object({
  title: z.string().trim().min(2),
  passMarkPercentage: z.number().int().min(1).max(100),
  questions: z
    .array(
      z.object({
        questionText: z.string().trim().min(3),
        answerOptions: z
          .array(z.object({ optionText: z.string().trim().min(1), isCorrectOption: z.boolean() }))
          .min(2, 'Each question needs at least two answer options')
          .refine((answerOptions) => answerOptions.filter((answerOption) => answerOption.isCorrectOption).length === 1, {
            message: 'Each question needs exactly one correct answer',
          }),
      }),
    )
    .min(1, 'Add at least one question'),
});

const assessmentSubmissionRequestSchema = z.object({
  answers: z.array(z.object({ assessmentQuestionId: z.string().min(1), selectedAnswerOptionId: z.string().min(1) })),
});

/** Instructor view: includes which option is correct. */
export const getLessonAssessmentForInstructor = asyncRequestHandler(async (request, response) => {
  await assertUserCanManageLesson(request.authenticatedUser!, request.params.lessonId);

  const matchingAssessment = await prismaDatabaseClient.assessment.findUnique({
    where: { lessonId: request.params.lessonId },
    include: {
      questions: { orderBy: { sequenceOrderNumber: 'asc' }, include: { answerOptions: true } },
    },
  });

  response.json({ assessment: matchingAssessment });
});

/** Replaces the whole quiz (title, pass mark, all questions) in one transaction. */
export const saveLessonAssessment = asyncRequestHandler(async (request, response) => {
  await assertUserCanManageLesson(request.authenticatedUser!, request.params.lessonId);
  const assessmentDefinition = assessmentDefinitionRequestSchema.parse(request.body);

  const savedAssessment = await prismaDatabaseClient.$transaction(async (databaseTransactionClient) => {
    await databaseTransactionClient.assessment.deleteMany({ where: { lessonId: request.params.lessonId } });

    return databaseTransactionClient.assessment.create({
      data: {
        lessonId: request.params.lessonId,
        title: assessmentDefinition.title,
        passMarkPercentage: assessmentDefinition.passMarkPercentage,
        questions: {
          create: assessmentDefinition.questions.map((question, questionIndex) => ({
            questionText: question.questionText,
            sequenceOrderNumber: questionIndex + 1,
            answerOptions: { create: question.answerOptions },
          })),
        },
      },
    });
  });

  response.status(201).json({ assessment: savedAssessment });
});

export const deleteLessonAssessment = asyncRequestHandler(async (request, response) => {
  await assertUserCanManageLesson(request.authenticatedUser!, request.params.lessonId);
  await prismaDatabaseClient.assessment.deleteMany({ where: { lessonId: request.params.lessonId } });
  response.status(204).send();
});

/** Student view: correct answers are NEVER sent to the browser. */
export const getLessonAssessmentForStudent = asyncRequestHandler(async (request, response) => {
  const matchingAssessment = await prismaDatabaseClient.assessment.findUnique({
    where: { lessonId: request.lessonAccessContext!.lessonId },
    include: {
      questions: {
        orderBy: { sequenceOrderNumber: 'asc' },
        include: { answerOptions: { select: { id: true, optionText: true } } },
      },
    },
  });

  if (!matchingAssessment) {
    throw new ApplicationError(404, 'This lesson has no assessment.', 'ASSESSMENT_NOT_FOUND');
  }

  const studentPreviousAttempts = await prismaDatabaseClient.assessmentAttempt.findMany({
    where: { assessmentId: matchingAssessment.id, studentUserId: request.authenticatedUser!.userId },
    orderBy: { submittedAt: 'desc' },
    select: { scorePercentage: true, hasPassed: true, submittedAt: true },
  });

  response.json({
    assessment: {
      assessmentId: matchingAssessment.id,
      title: matchingAssessment.title,
      passMarkPercentage: matchingAssessment.passMarkPercentage,
      questions: matchingAssessment.questions.map((question) => ({
        assessmentQuestionId: question.id,
        questionText: question.questionText,
        answerOptions: question.answerOptions.map((answerOption) => ({
          answerOptionId: answerOption.id,
          optionText: answerOption.optionText,
        })),
      })),
    },
    previousAttempts: studentPreviousAttempts,
  });
});

/** Step 5: "Submit Quiz -> Unlock Next Lesson". */
export const submitAssessmentAttempt = asyncRequestHandler(async (request, response) => {
  const lessonAccessContext = request.lessonAccessContext!;
  const studentUserId = request.authenticatedUser!.userId;
  const submittedAnswers = assessmentSubmissionRequestSchema.parse(request.body).answers;

  const matchingAssessment = await prismaDatabaseClient.assessment.findUnique({
    where: { lessonId: lessonAccessContext.lessonId },
    include: { questions: { include: { answerOptions: true } } },
  });

  if (!matchingAssessment) {
    throw new ApplicationError(404, 'This lesson has no assessment.', 'ASSESSMENT_NOT_FOUND');
  }

  const totalQuestionCount = matchingAssessment.questions.length;
  const selectedOptionIdByQuestionId = new Map(
    submittedAnswers.map((submittedAnswer) => [submittedAnswer.assessmentQuestionId, submittedAnswer.selectedAnswerOptionId]),
  );

  const correctAnswerCount = matchingAssessment.questions.filter((question) => {
    const selectedOptionId = selectedOptionIdByQuestionId.get(question.id);
    return question.answerOptions.some((answerOption) => answerOption.id === selectedOptionId && answerOption.isCorrectOption);
  }).length;

  const scorePercentage = totalQuestionCount === 0 ? 0 : Math.round((correctAnswerCount / totalQuestionCount) * 100);
  const hasPassed = scorePercentage >= matchingAssessment.passMarkPercentage;

  await prismaDatabaseClient.assessmentAttempt.create({
    data: { assessmentId: matchingAssessment.id, studentUserId, scorePercentage, hasPassed },
  });

  let isCertificateIssued = false;

  if (hasPassed) {
    await markLessonAsCompletedForStudent(studentUserId, lessonAccessContext.lessonId);
    const issuedCertificate = await issueCertificateIfStudentHasCompletedCourse(studentUserId, lessonAccessContext.courseId);
    isCertificateIssued = issuedCertificate !== null;
  }

  const updatedCourseProgress = await buildStudentCourseProgress(studentUserId, lessonAccessContext.courseId);

  response.json({
    scorePercentage,
    hasPassed,
    passMarkPercentage: matchingAssessment.passMarkPercentage,
    correctAnswerCount,
    totalQuestionCount,
    completionPercentage: updatedCourseProgress.completionPercentage,
    isCertificateIssued,
  });
});
