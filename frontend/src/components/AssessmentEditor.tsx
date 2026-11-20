import { useEffect, useState } from 'react';
import { extractErrorMessage, sendApiRequest } from '../services/applicationProgrammingInterfaceClient';
import type { InstructorAssessmentDefinition } from '../types/applicationTypes';
import { LoadingButtonContent } from './LoadingButtonContent';
import { StatusMessage } from './StatusMessage';

interface DraftAnswerOption {
  optionText: string;
  isCorrectOption: boolean;
}

interface DraftQuestion {
  questionText: string;
  answerOptions: DraftAnswerOption[];
}

interface AssessmentEditorProps {
  lessonId: string;
  onAssessmentChanged: () => void;
}

function createBlankQuestion(): DraftQuestion {
  return {
    questionText: '',
    answerOptions: [
      { optionText: '', isCorrectOption: true },
      { optionText: '', isCorrectOption: false },
    ],
  };
}

export function AssessmentEditor({ lessonId, onAssessmentChanged }: AssessmentEditorProps) {
  const [assessmentTitle, setAssessmentTitle] = useState('Lesson quiz');
  const [passMarkPercentage, setPassMarkPercentage] = useState(70);
  const [draftQuestions, setDraftQuestions] = useState<DraftQuestion[]>([createBlankQuestion()]);
  const [hasSavedAssessment, setHasSavedAssessment] = useState(false);
  const [statusKind, setStatusKind] = useState<'error' | 'success'>('success');
  const [statusText, setStatusText] = useState<string | null>(null);
  const [busyActionName, setBusyActionName] = useState<'saving' | 'deleting' | null>(null);
  const isBusy = busyActionName !== null;

  useEffect(() => {
    sendApiRequest<{ assessment: InstructorAssessmentDefinition | null }>(`/instructor/lessons/${lessonId}/assessment`)
      .then(({ assessment }) => {
        if (!assessment) return;
        setHasSavedAssessment(true);
        setAssessmentTitle(assessment.title);
        setPassMarkPercentage(assessment.passMarkPercentage);
        setDraftQuestions(
          assessment.questions.map((question) => ({
            questionText: question.questionText,
            answerOptions: question.answerOptions.map(({ optionText, isCorrectOption }) => ({ optionText, isCorrectOption })),
          })),
        );
      })
      .catch((loadError) => {
        setStatusKind('error');
        setStatusText(extractErrorMessage(loadError));
      });
  }, [lessonId]);

  const updateQuestion = (questionIndex: number, changes: Partial<DraftQuestion>) =>
    setDraftQuestions((previousQuestions) => previousQuestions.map((question, index) => (index === questionIndex ? { ...question, ...changes } : question)));

  const updateAnswerOption = (questionIndex: number, optionIndex: number, changes: Partial<DraftAnswerOption>) =>
    setDraftQuestions((previousQuestions) =>
      previousQuestions.map((question, index) =>
        index === questionIndex
          ? { ...question, answerOptions: question.answerOptions.map((option, currentOptionIndex) => (currentOptionIndex === optionIndex ? { ...option, ...changes } : option)) }
          : question,
      ),
    );

  const markOptionAsTheOnlyCorrectAnswer = (questionIndex: number, correctOptionIndex: number) =>
    setDraftQuestions((previousQuestions) =>
      previousQuestions.map((question, index) =>
        index === questionIndex
          ? { ...question, answerOptions: question.answerOptions.map((option, optionIndex) => ({ ...option, isCorrectOption: optionIndex === correctOptionIndex })) }
          : question,
      ),
    );

  const handleSaveClick = async () => {
    setBusyActionName('saving');
    setStatusText(null);
    try {
      await sendApiRequest(`/instructor/lessons/${lessonId}/assessment`, {
        httpMethod: 'PUT',
        jsonBody: { title: assessmentTitle, passMarkPercentage, questions: draftQuestions },
      });
      setHasSavedAssessment(true);
      setStatusKind('success');
      setStatusText('Quiz saved.');
      onAssessmentChanged();
    } catch (saveError) {
      setStatusKind('error');
      setStatusText(extractErrorMessage(saveError));
    } finally {
      setBusyActionName(null);
    }
  };

  const handleDeleteClick = async () => {
    if (!window.confirm('Remove this quiz? Students will then complete the lesson by finishing the video.')) return;
    setBusyActionName('deleting');
    try {
      await sendApiRequest(`/instructor/lessons/${lessonId}/assessment`, { httpMethod: 'DELETE' });
      setHasSavedAssessment(false);
      setDraftQuestions([createBlankQuestion()]);
      setStatusKind('success');
      setStatusText('Quiz removed.');
      onAssessmentChanged();
    } catch (deleteError) {
      setStatusKind('error');
      setStatusText(extractErrorMessage(deleteError));
    } finally {
      setBusyActionName(null);
    }
  };

  return (
    <div className="assessment-editor">
      <div className="form-row">
        <label className="form-field form-field--grow">
          <span>Quiz title</span>
          <input value={assessmentTitle} onChange={(changeEvent) => setAssessmentTitle(changeEvent.target.value)} />
        </label>
        <label className="form-field">
          <span>Pass mark (%)</span>
          <input type="number" min={1} max={100} value={passMarkPercentage} onChange={(changeEvent) => setPassMarkPercentage(Number(changeEvent.target.value))} />
        </label>
      </div>

      {draftQuestions.map((question, questionIndex) => (
        <div key={questionIndex} className="question-editor">
          <div className="row-spaced">
            <strong>Question {questionIndex + 1}</strong>
            {draftQuestions.length > 1 && (
              <button type="button" className="button button--danger button--small" onClick={() => setDraftQuestions((previous) => previous.filter((_, index) => index !== questionIndex))}>
                Remove
              </button>
            )}
          </div>
          <input
            placeholder="Type the question"
            value={question.questionText}
            onChange={(changeEvent) => updateQuestion(questionIndex, { questionText: changeEvent.target.value })}
          />
          {question.answerOptions.map((answerOption, optionIndex) => (
            <div key={optionIndex} className="answer-option-editor">
              <input
                type="radio"
                name={`correct-answer-for-question-${questionIndex}`}
                checked={answerOption.isCorrectOption}
                onChange={() => markOptionAsTheOnlyCorrectAnswer(questionIndex, optionIndex)}
                title="Mark as the correct answer"
              />
              <input
                placeholder={`Answer option ${optionIndex + 1}`}
                value={answerOption.optionText}
                onChange={(changeEvent) => updateAnswerOption(questionIndex, optionIndex, { optionText: changeEvent.target.value })}
              />
              {question.answerOptions.length > 2 && (
                <button
                  type="button"
                  className="button button--secondary button--small"
                  onClick={() =>
                    updateQuestion(questionIndex, {
                      answerOptions: question.answerOptions
                        .filter((_, index) => index !== optionIndex)
                        .map((option, index, remainingOptions) => ({
                          ...option,
                          isCorrectOption: remainingOptions.some((remainingOption) => remainingOption.isCorrectOption) ? option.isCorrectOption : index === 0,
                        })),
                    })
                  }
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="button button--secondary button--small"
            onClick={() => updateQuestion(questionIndex, { answerOptions: [...question.answerOptions, { optionText: '', isCorrectOption: false }] })}
          >
            + Add answer option
          </button>
        </div>
      ))}

      <StatusMessage messageKind={statusKind} messageText={statusText} />

      <div className="button-row">
        <button type="button" className="button button--secondary" onClick={() => setDraftQuestions((previous) => [...previous, createBlankQuestion()])}>
          + Add question
        </button>
        <button type="button" className="button button--primary" onClick={handleSaveClick} disabled={isBusy}>
          <LoadingButtonContent isLoading={busyActionName === 'saving'} loadingText="Saving...">
            Save quiz
          </LoadingButtonContent>
        </button>
        {hasSavedAssessment && (
          <button type="button" className="button button--danger" onClick={handleDeleteClick} disabled={isBusy}>
            <LoadingButtonContent isLoading={busyActionName === 'deleting'} loadingText="Removing...">
              Remove quiz
            </LoadingButtonContent>
          </button>
        )}
      </div>
    </div>
  );
}
