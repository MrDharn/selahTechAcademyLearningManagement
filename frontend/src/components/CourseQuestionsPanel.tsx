import { useCallback, useEffect, useState } from 'react';
import { LoadingButtonContent } from './LoadingButtonContent';
import { LoadingIndicator } from './LoadingIndicator';
import { StatusMessage } from './StatusMessage';
import { extractErrorMessage, sendApiRequest } from '../services/applicationProgrammingInterfaceClient';
import type { LessonQuestionItem } from '../types/applicationTypes';
import { formatCalendarDate } from '../utilities/formattingUtilities';

/** Instructor view: every student question in the course, unanswered ones first. */
export function CourseQuestionsPanel({ courseId }: { courseId: string }) {
  const [questions, setQuestions] = useState<LessonQuestionItem[] | null>(null);
  const [unansweredQuestionCount, setUnansweredQuestionCount] = useState(0);
  const [answerDraftByQuestionId, setAnswerDraftByQuestionId] = useState<Record<string, string>>({});
  const [questionIdBeingAnswered, setQuestionIdBeingAnswered] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadQuestions = useCallback(async () => {
    try {
      const loaded = await sendApiRequest<{ questions: LessonQuestionItem[]; unansweredQuestionCount: number }>(`/instructor/courses/${courseId}/questions`);
      setQuestions(loaded.questions);
      setUnansweredQuestionCount(loaded.unansweredQuestionCount);
    } catch (loadError) {
      setErrorMessage(extractErrorMessage(loadError));
    }
  }, [courseId]);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  const handleAnswer = async (questionId: string, submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    setErrorMessage(null);
    setQuestionIdBeingAnswered(questionId);
    try {
      await sendApiRequest(`/instructor/questions/${questionId}/answers`, { httpMethod: 'POST', jsonBody: { text: answerDraftByQuestionId[questionId] ?? '' } });
      setAnswerDraftByQuestionId((previousDrafts) => ({ ...previousDrafts, [questionId]: '' }));
      await loadQuestions();
    } catch (answerError) {
      setErrorMessage(extractErrorMessage(answerError));
    } finally {
      setQuestionIdBeingAnswered(null);
    }
  };

  const handleDelete = async (questionId: string) => {
    if (!window.confirm('Delete this question and its answers?')) return;
    try {
      await sendApiRequest(`/instructor/questions/${questionId}`, { httpMethod: 'DELETE' });
      await loadQuestions();
    } catch (deleteError) {
      setErrorMessage(extractErrorMessage(deleteError));
    }
  };

  return (
    <div className="card">
      <h3>
        Student questions {unansweredQuestionCount > 0 && <span className="badge badge--warning">{unansweredQuestionCount} waiting</span>}
      </h3>
      <StatusMessage messageKind="error" messageText={errorMessage} />
      {!questions && !errorMessage && <LoadingIndicator layoutVariant="inline" />}
      {questions?.length === 0 && <p className="muted-text">No questions from students yet.</p>}
      {questions?.map((question) => (
        <article key={question.questionId} className="question-card">
          <div className="review-card__header">
            <strong>{question.askedByDisplayName}</strong>
            <span className="muted-text">
              on “{question.lessonTitle}” · {formatCalendarDate(question.createdAt)}
            </span>
            <button type="button" className="button button--danger button--small" onClick={() => handleDelete(question.questionId)}>
              Delete
            </button>
          </div>
          <p className="question-card__text">{question.questionText}</p>
          {question.answers.map((answer) => (
            <div key={answer.answerId} className={answer.isFromInstructor ? 'answer-block answer-block--instructor' : 'answer-block'}>
              <strong>{answer.answeredByDisplayName}</strong> <span className="muted-text">{formatCalendarDate(answer.createdAt)}</span>
              <p className="question-card__text">{answer.answerText}</p>
            </div>
          ))}
          <form className="inline-form" onSubmit={(submitEvent) => handleAnswer(question.questionId, submitEvent)}>
            <input
              placeholder="Write an answer"
              value={answerDraftByQuestionId[question.questionId] ?? ''}
              onChange={(changeEvent) => setAnswerDraftByQuestionId((previousDrafts) => ({ ...previousDrafts, [question.questionId]: changeEvent.target.value }))}
              required
              minLength={3}
              maxLength={1000}
            />
            <button type="submit" className="button button--secondary" disabled={questionIdBeingAnswered === question.questionId}>
              <LoadingButtonContent isLoading={questionIdBeingAnswered === question.questionId} loadingText="Sending...">
                Answer
              </LoadingButtonContent>
            </button>
          </form>
        </article>
      ))}
    </div>
  );
}
