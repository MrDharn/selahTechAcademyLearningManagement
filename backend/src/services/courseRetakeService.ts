import type { Prisma } from '@prisma/client';

/**
 * Restarts a course for one student: lesson progress and quiz attempts of THIS course are cleared, so lessons unlock
 * from the first one again. The certificate they already earned is kept.
 */
export async function resetStudentCourseProgressForRetake(
  databaseTransactionClient: Prisma.TransactionClient,
  studentUserId: string,
  courseId: string,
): Promise<void> {
  await databaseTransactionClient.lessonProgress.deleteMany({
    where: { studentUserId, lesson: { courseModule: { courseId } } },
  });
  await databaseTransactionClient.assessmentAttempt.deleteMany({
    where: { studentUserId, assessment: { lesson: { courseModule: { courseId } } } },
  });
}
