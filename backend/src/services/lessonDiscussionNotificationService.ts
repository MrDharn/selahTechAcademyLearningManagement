import { environmentConfiguration } from '../configuration/environmentConfiguration';
import { prismaDatabaseClient } from '../database/prismaDatabaseClient';
import { formatReviewerDisplayName } from '../rules/courseRatingRules';
import { sendEmail } from './emailDeliveryService';
import { buildNewQuestionEmail, buildQuestionAnsweredEmail } from './emailTemplates';

/**
 * Tell the course owner that a student asked something, so instructors do not have to keep checking the site.
 * Never throws and is not awaited by the request: a mail problem must not stop a student from asking.
 */
export async function notifyInstructorAboutNewQuestion(questionId: string): Promise<void> {
  try {
    const question = await prismaDatabaseClient.lessonQuestion.findUnique({
      where: { id: questionId },
      include: {
        askedByUser: { select: { fullName: true } },
        lesson: { select: { title: true, courseModule: { select: { course: { select: { id: true, title: true, instructorUser: { select: { fullName: true, emailAddress: true } } } } } } } },
      },
    });
    if (!question) return;

    const course = question.lesson.courseModule.course;
    await sendEmail(
      buildNewQuestionEmail({
        recipientEmailAddress: course.instructorUser.emailAddress,
        instructorFullName: course.instructorUser.fullName,
        studentDisplayName: formatReviewerDisplayName(question.askedByUser.fullName),
        courseTitle: course.title,
        lessonTitle: question.lesson.title,
        questionText: question.questionText,
        answerPageUrl: `${environmentConfiguration.frontendBaseUrl}/instructor/courses/${course.id}`,
      }),
    );
  } catch (notificationError) {
    console.error('[question notification failed]', notificationError);
  }
}

/** Tell the student their question was answered. */
export async function notifyStudentAboutAnswer(answerId: string): Promise<void> {
  try {
    const answer = await prismaDatabaseClient.lessonAnswer.findUnique({
      where: { id: answerId },
      include: {
        question: {
          include: {
            askedByUser: { select: { id: true, fullName: true, emailAddress: true } },
            lesson: { select: { id: true, title: true, courseModule: { select: { course: { select: { id: true, title: true } } } } } },
          },
        },
      },
    });
    if (!answer) return;

    const { question } = answer;
    // Do not e-mail someone about their own reply.
    if (question.askedByUser.id === answer.answeredByUserId) return;

    const course = question.lesson.courseModule.course;
    await sendEmail(
      buildQuestionAnsweredEmail({
        recipientEmailAddress: question.askedByUser.emailAddress,
        studentFullName: question.askedByUser.fullName,
        courseTitle: course.title,
        lessonTitle: question.lesson.title,
        questionText: question.questionText,
        answerText: answer.answerText,
        lessonPageUrl: `${environmentConfiguration.frontendBaseUrl}/learn/${course.id}/lessons/${question.lesson.id}`,
      }),
    );
  } catch (notificationError) {
    console.error('[answer notification failed]', notificationError);
  }
}
