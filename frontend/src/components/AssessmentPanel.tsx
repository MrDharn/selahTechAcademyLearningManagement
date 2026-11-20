import { useState } from 'react';
import { extractErrorMessage, sendApiRequest } from '../services/applicationProgrammingInterfaceClient';
import type { AssessmentSubmissionResult, StudentAssessmentResponse } from '../types/applicationTypes';
import { LoadingButtonContent } from './LoadingButtonContent';
import { StatusMessage } from './StatusMessage';

interface AssessmentPanelProps {
  lessonId: string;
  onAssessmentPassed: () => void;
}

/** Step 5: "Take Assessment -> Submit Quiz -> Unlock Next Lesson". */
export function AssessmentPanel({ lessonId, onAssessmentPassed }: AssessmentPanelProps) {
  const [assessmentResponse, setAssessmentResponse] = useState<StudentAssessmentResponse | null>(null);
  const [selectedAnswerOptionIdByQuestionId, setSelectedAnswerOptionIdByQuestionId] = useState<Record<string, string>>({});
  const [submissionResult, setSubmissionResult] = useState<AssessmentSubmissionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const handleStartAssessmentClick = async () => {
    setIsBusy(true);
    setErrorMessage(null);
    setSubmissionResult(null);
    setSelectedAnswerOptionIdByQuestionId({});
    try {
      setAssessmentResponse(await sendApiRequest<StudentAssessmentResponse>(`/learning/lessons/${lessonId}/assessment`));
    } catch (loadError) {
      setErrorMessage(extractErrorMessage(loadError));
    } finally {
      setIsBusy(false);
    }
  };

  const handleSubmitAssessment = async () => {
    if (!assessmentResponse) return;
    setIsBusy(true);
    setErrorMessage(null);
    try {
      const result = await sendApiRequest<AssessmentSubmissionResult>(`/learning/lessons/${lessonId}/assessment/attempts`, {
        httpMethod: 'POST',
        jsonBody: {
          answers: Object.entries(selectedAnswerOptionIdByQuestionId).map(([assessmentQuestionId, selectedAnswerOptionId]) => ({
            assessmentQuestionId,
            selectedAnswerOptionId,
          })),
        },
      });
      setSubmissionResult(result);
      if (result.hasPassed) onAssessmentPassed();
    } catch (submitError) {
      setErrorMessage(extractErrorMessage(submitError));
    } finally {
      setIsBusy(false);
    }
  };

  if (!assessmentResponse) {
    return (
      <div className="card assessment-panel">
        <h3>Lesson quiz</h3>
        <p className="muted-text">Pass the quiz to complete this lesson and unlock the next one.</p>
        <StatusMessage messageKind="error" messageText={errorMessage} />
        <button type="button" className="button button--primary" onClick={handleStartAssessmentClick} disabled={isBusy}>
          <LoadingButtonContent isLoading={isBusy} loadingText="Loading quiz...">
            Take the quiz
          </LoadingButtonContent>
        </button>
      </div>
    );
  }

  const numberOfAnsweredQuestions = Object.keys(selectedAnswerOptionIdByQuestionId).length;
  const totalNumberOfQuestions = assessmentResponse.assessment.questions.length;

  return (
    <div className="card assessment-panel">
      <h3>{assessmentResponse.assessment.title}</h3>
      <p className="muted-text">Pass mark: {assessmentResponse.assessment.passMarkPercentage}%</p>
      <StatusMessage messageKind="error" messageText={errorMessage} />

      {submissionResult ? (
        <>
          <StatusMessage
            messageKind={submissionResult.hasPassed ? 'success' : 'warning'}
            messageText={
              submissionResult.hasPassed
                ? `Passed! You scored ${submissionResult.scorePercentage}% (${submissionResult.correctAnswerCount}/${submissionResult.totalQuestionCount}). The next lesson is unlocked.${submissionResult.isCertificateIssued ? ' 🎓 Your certificate is ready!' : ''}`
                : `You scored ${submissionResult.scorePercentage}% (${submissionResult.correctAnswerCount}/${submissionResult.totalQuestionCount}). You need ${submissionResult.passMarkPercentage}% to pass.`
            }
          />
          {!submissionResult.hasPassed && (
            <button type="button" className="button button--primary" onClick={handleStartAssessmentClick}>
              Try again
            </button>
          )}
        </>
      ) : (
        <>
          {assessmentResponse.assessment.questions.map((question, questionIndex) => (
            <fieldset key={question.assessmentQuestionId} className="question-block">
              <legend>
                {questionIndex + 1}. {question.questionText}
              </legend>
              {question.answerOptions.map((answerOption) => (
                <label key={answerOption.answerOptionId} className="answer-option">
                  <input
                    type="radio"
                    name={question.assessmentQuestionId}
                    checked={selectedAnswerOptionIdByQuestionId[question.assessmentQuestionId] === answerOption.answerOptionId}
                    onChange={() =>
                      setSelectedAnswerOptionIdByQuestionId((previousSelections) => ({
                        ...previousSelections,
                        [question.assessmentQuestionId]: answerOption.answerOptionId,
                      }))
                    }
                  />
                  {answerOption.optionText}
                </label>
              ))}
            </fieldset>
          ))}

          <button
            type="button"
            className="button button--primary"
            onClick={handleSubmitAssessment}
            disabled={isBusy || numberOfAnsweredQuestions < totalNumberOfQuestions}
          >
            <LoadingButtonContent isLoading={isBusy} loadingText="Submitting...">
              {`Submit (${numberOfAnsweredQuestions}/${totalNumberOfQuestions} answered)`}
            </LoadingButtonContent>
          </button>
        </>
      )}
    </div>
  );
}
