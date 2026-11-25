export const MAXIMUM_QUESTION_LENGTH = 1000;
export const MAXIMUM_QUESTIONS_PER_STUDENT_PER_HOUR = 10;

/** Collapses whitespace so a message of only spaces/newlines is treated as empty. */
export function normalizeDiscussionText(rawText: string): string {
  return rawText.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

export function isDiscussionTextAcceptable(rawText: string): boolean {
  const normalizedText = normalizeDiscussionText(rawText);
  return normalizedText.length >= 3 && normalizedText.length <= MAXIMUM_QUESTION_LENGTH;
}

/** Unanswered questions first (oldest first, so nobody waits forever), then answered ones newest first. */
export function orderQuestionsForInstructor<QuestionForOrdering extends { createdAt: Date; answerCount: number }>(questions: QuestionForOrdering[]): QuestionForOrdering[] {
  return [...questions].sort((firstQuestion, secondQuestion) => {
    const firstIsUnanswered = firstQuestion.answerCount === 0;
    const secondIsUnanswered = secondQuestion.answerCount === 0;
    if (firstIsUnanswered !== secondIsUnanswered) return firstIsUnanswered ? -1 : 1;
    return firstIsUnanswered
      ? firstQuestion.createdAt.getTime() - secondQuestion.createdAt.getTime()
      : secondQuestion.createdAt.getTime() - firstQuestion.createdAt.getTime();
  });
}
