import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AssessmentPanel } from '../components/AssessmentPanel';
import { HlsVideoPlayer } from '../components/HlsVideoPlayer';
import { LoadingButtonContent } from '../components/LoadingButtonContent';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { ProgressBar } from '../components/ProgressBar';
import { StatusMessage } from '../components/StatusMessage';
import { ApiRequestError, extractErrorMessage, sendApiRequest } from '../services/applicationProgrammingInterfaceClient';
import type { CourseProgressResponse, LessonStreamResponse } from '../types/applicationTypes';
import { formatCalendarDate, formatDurationInMinutesAndSeconds } from '../utilities/formattingUtilities';

/** Step 4: "Watch Lessons". Routes: /learn/:courseId  and  /learn/:courseId/lessons/:lessonId */
export function LessonPlayerPage() {
  const { courseId, lessonId: selectedLessonId } = useParams();
  const navigateToPage = useNavigate();

  const [courseProgressResponse, setCourseProgressResponse] = useState<CourseProgressResponse | null>(null);
  const [lessonStream, setLessonStream] = useState<LessonStreamResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  const [isLoadingLessonStream, setIsLoadingLessonStream] = useState(false);
  const [isMarkingLessonComplete, setIsMarkingLessonComplete] = useState(false);

  const loadCourseProgress = useCallback(async () => {
    try {
      setCourseProgressResponse(await sendApiRequest<CourseProgressResponse>(`/learning/courses/${courseId}/progress`));
    } catch (progressError) {
      setErrorMessage(extractErrorMessage(progressError));
      setErrorCode(progressError instanceof ApiRequestError ? progressError.machineReadableErrorCode : undefined);
    }
  }, [courseId]);

  useEffect(() => {
    void loadCourseProgress();
  }, [loadCourseProgress]);

  // /learn/:courseId without a lesson -> jump to the first lesson that is open and not completed.
  useEffect(() => {
    if (!courseProgressResponse || selectedLessonId) return;
    const lessonsInCourse = courseProgressResponse.progress.lessons;
    const lessonToOpenFirst = lessonsInCourse.find((lesson) => lesson.isUnlocked && !lesson.isCompleted) ?? lessonsInCourse[0];
    if (lessonToOpenFirst) navigateToPage(`/learn/${courseId}/lessons/${lessonToOpenFirst.lessonId}`, { replace: true });
  }, [courseProgressResponse, selectedLessonId, courseId, navigateToPage]);

  useEffect(() => {
    if (!selectedLessonId) return;
    setLessonStream(null);
    setErrorMessage(null);
    setErrorCode(undefined);
    setIsLoadingLessonStream(true);

    sendApiRequest<LessonStreamResponse>(`/learning/lessons/${selectedLessonId}/stream`)
      .then(setLessonStream)
      .catch((streamError) => {
        setErrorMessage(extractErrorMessage(streamError));
        setErrorCode(streamError instanceof ApiRequestError ? streamError.machineReadableErrorCode : undefined);
      })
      .finally(() => setIsLoadingLessonStream(false));
  }, [selectedLessonId]);

  const selectedLessonProgress = useMemo(
    () => courseProgressResponse?.progress.lessons.find((lesson) => lesson.lessonId === selectedLessonId) ?? null,
    [courseProgressResponse, selectedLessonId],
  );

  const nextLesson = useMemo(() => {
    if (!courseProgressResponse || !selectedLessonProgress) return null;
    return courseProgressResponse.progress.lessons.find((lesson) => lesson.positionInCourse === selectedLessonProgress.positionInCourse + 1) ?? null;
  }, [courseProgressResponse, selectedLessonProgress]);

  const handleWatchPositionChange = (currentPositionInSeconds: number) => {
    if (!selectedLessonId) return;
    sendApiRequest(`/learning/lessons/${selectedLessonId}/watch-position`, {
      httpMethod: 'PUT',
      jsonBody: { lastWatchedPositionInSeconds: currentPositionInSeconds },
    }).catch(() => undefined); // progress saving is best-effort
  };

  const handleMarkLessonAsCompleted = async () => {
    if (!selectedLessonId) return;
    setIsMarkingLessonComplete(true);
    try {
      await sendApiRequest(`/learning/lessons/${selectedLessonId}/complete`, { httpMethod: 'POST' });
      await loadCourseProgress();
    } catch (completionError) {
      setErrorMessage(extractErrorMessage(completionError));
    } finally {
      setIsMarkingLessonComplete(false);
    }
  };

  const handlePlaybackEnded = () => {
    if (selectedLessonProgress && !selectedLessonProgress.hasAssessment && !selectedLessonProgress.isCompleted) {
      void handleMarkLessonAsCompleted();
    }
  };

  if (!courseProgressResponse) {
    return (
      <div className="page-container">
        <StatusMessage messageKind="error" messageText={errorMessage} />
        {errorCode === 'ACCESS_EXPIRED' && (
          <Link to={`/courses/${courseId}`} className="button button--accent">
            Renew access
          </Link>
        )}
        {!errorMessage && <LoadingIndicator message="Loading your course..." />}
      </div>
    );
  }

  const { progress, courseAccessStatus } = courseProgressResponse;
  let previousModuleId: string | null = null;

  return (
    <div className="lesson-player-layout">
      <aside className="lesson-sidebar">
        <Link to="/my-learning" className="muted-text">
          ← My learning
        </Link>
        <h2>{courseProgressResponse.courseTitle}</h2>
        <ProgressBar completionPercentage={progress.completionPercentage} />
        <p className="muted-text">{progress.completionPercentage}% complete</p>

        {progress.lessons.map((lesson) => {
          const shouldShowModuleHeading = lesson.courseModuleId !== previousModuleId;
          previousModuleId = lesson.courseModuleId;

          return (
            <div key={lesson.lessonId}>
              {shouldShowModuleHeading && <p className="lesson-sidebar__module-title">{lesson.courseModuleTitle}</p>}
              {lesson.isUnlocked ? (
                <Link
                  to={`/learn/${courseId}/lessons/${lesson.lessonId}`}
                  className={`lesson-sidebar__item ${lesson.lessonId === selectedLessonId ? 'lesson-sidebar__item--active' : ''}`}
                >
                  <span>{lesson.isCompleted ? '✅' : '▶'}</span>
                  <span>{lesson.lessonTitle}</span>
                  <span className="muted-text">{formatDurationInMinutesAndSeconds(lesson.videoDurationInSeconds)}</span>
                </Link>
              ) : (
                <div className="lesson-sidebar__item lesson-sidebar__item--locked" title="Complete the previous lesson to unlock">
                  <span>🔒</span>
                  <span>{lesson.lessonTitle}</span>
                </div>
              )}
            </div>
          );
        })}

        {progress.isCourseFullyCompleted && (
          <Link to="/my-certificates" className="button button--accent button--full-width">
            🎓 Get your certificate
          </Link>
        )}
      </aside>

      <main className="lesson-main">
        {courseAccessStatus === 'GRACE_PERIOD' && (
          <StatusMessage
            messageKind="warning"
            messageText={`Your paid access ended on ${formatCalendarDate(courseProgressResponse.accessExpiresAt)}. You are in the grace period until ${formatCalendarDate(courseProgressResponse.gracePeriodEndsAt)}. Renew from the course page to keep learning.`}
          />
        )}

        <StatusMessage messageKind="error" messageText={errorMessage} />
        {errorCode === 'ACCESS_EXPIRED' && (
          <Link to={`/courses/${courseId}`} className="button button--accent">
            Renew access
          </Link>
        )}
        {isLoadingLessonStream && <LoadingIndicator message="Preparing your video..." />}

        {lessonStream && selectedLessonProgress && (
          <>
            <HlsVideoPlayer
              key={lessonStream.lessonId}
              hlsStreamingUrl={lessonStream.hlsStreamingUrl}
              initialPositionInSeconds={lessonStream.lastWatchedPositionInSeconds}
              onWatchPositionChange={handleWatchPositionChange}
              onPlaybackEnded={handlePlaybackEnded}
            />
            <h1>{lessonStream.lessonTitle}</h1>
            {lessonStream.lessonDescription && <p className="muted-text">{lessonStream.lessonDescription}</p>}

            {selectedLessonProgress.hasAssessment ? (
              <AssessmentPanel key={lessonStream.lessonId} lessonId={lessonStream.lessonId} onAssessmentPassed={loadCourseProgress} />
            ) : (
              !selectedLessonProgress.isCompleted && (
                <button type="button" className="button button--primary" onClick={handleMarkLessonAsCompleted} disabled={isMarkingLessonComplete}>
                  <LoadingButtonContent isLoading={isMarkingLessonComplete} loadingText="Saving...">
                    Mark lesson as complete
                  </LoadingButtonContent>
                </button>
              )
            )}

            {selectedLessonProgress.isCompleted && nextLesson?.isUnlocked && (
              <Link to={`/learn/${courseId}/lessons/${nextLesson.lessonId}`} className="button button--accent">
                Next lesson: {nextLesson.lessonTitle} →
              </Link>
            )}
          </>
        )}
      </main>
    </div>
  );
}
