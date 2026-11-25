import { useCallback, useEffect, useState } from 'react';
import { LoadingButtonContent } from './LoadingButtonContent';
import { StatusMessage } from './StatusMessage';
import { extractErrorMessage, sendApiRequest } from '../services/applicationProgrammingInterfaceClient';
import type { LessonQuestionItem } from '../types/applicationTypes';
import { formatCalendarDate } from '../utilities/formattingUtilities';

/** Student view: questions and answers for this lesson. Instructors answer from their course editor. */
export function LessonQuestionsPanel({ lessonId }: { lessonId: string }) {
  const [questions, setQuestions] = useState<LessonQuestionItem[] | null>(null);
  const [questionTextDraft, setQuestionTextDraft] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadQuestions = useCallback(async () => {
    try {
      const loaded = await sendApiRequest<{ questions: LessonQuestionItem[] }>(`/learning/lessons/${lessonId}/questions`);
      setQuestions(loaded.questions);
    } catch (loadError) {
      setErrorMessage(extractErrorMessage(loadError));
    }
  }, [lessonId]);

  useEffect(() => {
    setQuestions(null);
    setQuestionTextDraft('');
    void loadQuestions();
  }, [loadQuestions]);

  const handleAsk = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    setErrorMessage(null);
    setIsAsking(true);
    try {
      await sendApiRequest(`/learning/lessons/${lessonId}/questions`, { httpMethod: 'POST', jsonBody: { text: questionTextDraft } });
      setQuestionTextDraft('');
      await loadQuestions();
    } catch (askError) {
      setErrorMessage(extractErrorMessage(askError));
    } finally {
      setIsAsking(false);
    }
  };

  const handleDelete = async (questionId: string) => {
    if (!window.confirm('Delete this question and its answers?')) return;
    try {
      await sendApiRequest(`/learning/lessons/${lessonId}/questions/${questionId}`, { httpMethod: 'DELETE' });
      await loadQuestions();
    } catch (deleteError) {
      setErrorMessage(extractErrorMessage(deleteError));
    }
  };

  return (
    <section className="lesson-questions">
      <h2>Questions &amp; answers</h2>
      <form className="form-stack" onSubmit={handleAsk}>
        <textarea value={questionTextDraft} onChange={(changeEvent) => setQuestionTextDraft(changeEvent.target.value)} rows={3} maxLength={1000} placeholder="Stuck on something in this lesson? Ask here." required minLength={3} />
        <div>
          <button type="submit" className="button button--primary" disabled={isAsking}>
            <LoadingButtonContent isLoading={isAsking} loadingText="Posting...">
              Ask a question
            </LoadingButtonContent>
          </button>
        </div>
      </form>
      <StatusMessage messageKind="error" messageText={errorMessage} />

      {questions?.length === 0 && <p className="muted-text">No questions yet. Be the first to ask.</p>}
      {questions?.map((question) => (
        <article key={question.questionId} className="card question-card">
          <div className="review-card__header">
            <strong>{question.askedByDisplayName}</strong>
            <span className="muted-text">{formatCalendarDate(question.createdAt)}</span>
            {question.canDelete && (
              <button type="button" className="button button--danger button--small" onClick={() => handleDelete(question.questionId)}>
                Delete
              </button>
            )}
          </div>
          <p className="question-card__text">{question.questionText}</p>
          {question.answers.length === 0 && <p className="muted-text">Waiting for an answer.</p>}
          {question.answers.map((answer) => (
            <div key={answer.answerId} className={answer.isFromInstructor ? 'answer-block answer-block--instructor' : 'answer-block'}>
              <strong>{answer.answeredByDisplayName}</strong> {answer.isFromInstructor && <span className="badge badge--success">Instructor</span>}
              <p className="question-card__text">{answer.answerText}</p>
            </div>
          ))}
        </article>
      ))}
    </section>
  );
}
