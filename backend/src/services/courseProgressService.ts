import { prismaDatabaseClient } from '../database/prismaDatabaseClient';

export interface OrderedCourseLesson {
  lessonId: string;
  lessonTitle: string;
  courseModuleId: string;
  courseModuleTitle: string;
  positionInCourse: number;
  hasAssessment: boolean;
  videoDurationInSeconds: number | null;
  hasUploadedVideo: boolean;
}

export interface StudentLessonProgressSummary extends OrderedCourseLesson {
  isCompleted: boolean;
  isUnlocked: boolean;
  lastWatchedPositionInSeconds: number;
}

export interface StudentCourseProgressSummary {
  courseId: string;
  lessons: StudentLessonProgressSummary[];
  completedLessonCount: number;
  totalLessonCount: number;
  completionPercentage: number;
  isCourseFullyCompleted: boolean;
}

/** Flattens modules -> lessons into one ordered list (module order first, then lesson order). */
export async function getOrderedLessonsForCourse(
  courseId: string,
  onlyModulesIncludedInScholarship: boolean = false,
): Promise<OrderedCourseLesson[]> {
  const courseModulesWithLessons = await prismaDatabaseClient.courseModule.findMany({
    where: { courseId, ...(onlyModulesIncludedInScholarship ? { isIncludedInScholarship: true } : {}) },
    orderBy: { sequenceOrderNumber: 'asc' },
    include: {
      lessons: {
        orderBy: { sequenceOrderNumber: 'asc' },
        include: { assessment: { select: { id: true } } },
      },
    },
  });

  const orderedLessons: OrderedCourseLesson[] = [];

  for (const courseModule of courseModulesWithLessons) {
    for (const lesson of courseModule.lessons) {
      orderedLessons.push({
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        courseModuleId: courseModule.id,
        courseModuleTitle: courseModule.title,
        positionInCourse: orderedLessons.length + 1,
        hasAssessment: lesson.assessment !== null,
        videoDurationInSeconds: lesson.videoDurationInSeconds,
        hasUploadedVideo: lesson.cloudinaryVideoPublicId !== null,
      });
    }
  }

  return orderedLessons;
}

/** Sequential unlocking: lesson #1 is always open; lesson #N opens once lesson #N-1 is completed. */
export async function buildStudentCourseProgress(studentUserId: string, courseId: string): Promise<StudentCourseProgressSummary> {
  // Scholarship students only receive the modules the instructor included in the scholarship program.
  const studentEnrollment = await prismaDatabaseClient.enrollment.findUnique({
    where: { studentUserId_courseId: { studentUserId, courseId } },
    select: { enrollmentType: true },
  });
  const orderedLessons = await getOrderedLessonsForCourse(courseId, studentEnrollment?.enrollmentType === 'SCHOLARSHIP');

  const studentProgressRecords = await prismaDatabaseClient.lessonProgress.findMany({
    where: { studentUserId, lessonId: { in: orderedLessons.map((lesson) => lesson.lessonId) } },
  });

  const progressRecordByLessonId = new Map(studentProgressRecords.map((progressRecord) => [progressRecord.lessonId, progressRecord]));

  const lessonsWithProgress: StudentLessonProgressSummary[] = orderedLessons.map((orderedLesson, lessonIndex) => {
    const previousLesson = lessonIndex > 0 ? orderedLessons[lessonIndex - 1] : null;
    const isPreviousLessonCompleted = previousLesson
      ? progressRecordByLessonId.get(previousLesson.lessonId)?.isCompleted === true
      : true;
    const currentLessonProgressRecord = progressRecordByLessonId.get(orderedLesson.lessonId);

    return {
      ...orderedLesson,
      isCompleted: currentLessonProgressRecord?.isCompleted === true,
      isUnlocked: isPreviousLessonCompleted,
      lastWatchedPositionInSeconds: currentLessonProgressRecord?.lastWatchedPositionInSeconds ?? 0,
    };
  });

  const completedLessonCount = lessonsWithProgress.filter((lesson) => lesson.isCompleted).length;
  const totalLessonCount = lessonsWithProgress.length;

  return {
    courseId,
    lessons: lessonsWithProgress,
    completedLessonCount,
    totalLessonCount,
    completionPercentage: totalLessonCount === 0 ? 0 : Math.round((completedLessonCount / totalLessonCount) * 100),
    isCourseFullyCompleted: totalLessonCount > 0 && completedLessonCount === totalLessonCount,
  };
}

export async function markLessonAsCompletedForStudent(studentUserId: string, lessonId: string) {
  return prismaDatabaseClient.lessonProgress.upsert({
    where: { studentUserId_lessonId: { studentUserId, lessonId } },
    create: { studentUserId, lessonId, isCompleted: true, completedAt: new Date() },
    update: { isCompleted: true, completedAt: new Date() },
  });
}

export async function saveLastWatchedPosition(studentUserId: string, lessonId: string, lastWatchedPositionInSeconds: number) {
  return prismaDatabaseClient.lessonProgress.upsert({
    where: { studentUserId_lessonId: { studentUserId, lessonId } },
    create: { studentUserId, lessonId, lastWatchedPositionInSeconds },
    update: { lastWatchedPositionInSeconds },
  });
}
