import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AssessmentEditor } from '../components/AssessmentEditor';
import { WorkingNotice } from '../components/WorkingNotice';
import { CourseThumbnailUploader } from '../components/CourseThumbnailUploader';
import { LessonVideoUploader } from '../components/LessonVideoUploader';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { StatusMessage } from '../components/StatusMessage';
import { extractErrorMessage, sendApiRequest } from '../services/applicationProgrammingInterfaceClient';
import type { EditableCourse } from '../types/applicationTypes';
import { convertNairaToKobo, formatDurationInMinutesAndSeconds } from '../utilities/formattingUtilities';
import { SUGGESTED_COURSE_CATEGORIES } from '../utilities/courseCategoryUtilities';

export function InstructorCourseEditorPage() {
  const { courseId } = useParams();
  const navigateToPage = useNavigate();

  const [editableCourse, setEditableCourse] = useState<EditableCourse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [courseTitleDraft, setCourseTitleDraft] = useState('');
  const [courseDescriptionDraft, setCourseDescriptionDraft] = useState('');
  const [coursePriceInNairaDraft, setCoursePriceInNairaDraft] = useState(0);
  const [courseCategoryDraft, setCourseCategoryDraft] = useState('General');

  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [newLessonTitleByModuleId, setNewLessonTitleByModuleId] = useState<Record<string, string>>({});
  const [lessonIdWithOpenQuizEditor, setLessonIdWithOpenQuizEditor] = useState<string | null>(null);

  const loadCourse = useCallback(async () => {
    try {
      const { course } = await sendApiRequest<{ course: EditableCourse }>(`/instructor/courses/${courseId}`);
      setEditableCourse(course);
      setCourseTitleDraft(course.title);
      setCourseDescriptionDraft(course.description);
      setCoursePriceInNairaDraft(course.priceInKobo / 100);
      setCourseCategoryDraft(course.category);
    } catch (loadError) {
      setErrorMessage(extractErrorMessage(loadError));
    }
  }, [courseId]);

  useEffect(() => {
    void loadCourse();
  }, [loadCourse]);

  const [isRunningAction, setIsRunningAction] = useState(false);

  const runAction = async (actionToRun: () => Promise<unknown>, successText?: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsRunningAction(true);
    try {
      await actionToRun();
      await loadCourse();
      if (successText) setSuccessMessage(successText);
    } catch (actionError) {
      setErrorMessage(extractErrorMessage(actionError));
    } finally {
      setIsRunningAction(false);
    }
  };

  const handleSaveCourseDetails = (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    void runAction(
      () =>
        sendApiRequest(`/instructor/courses/${courseId}`, {
          httpMethod: 'PATCH',
          jsonBody: { title: courseTitleDraft, description: courseDescriptionDraft, category: courseCategoryDraft, priceInKobo: convertNairaToKobo(coursePriceInNairaDraft) },
        }),
      'Course details saved.',
    );
  };

  const handleTogglePublished = () =>
    runAction(
      () => sendApiRequest(`/instructor/courses/${courseId}`, { httpMethod: 'PATCH', jsonBody: { isPublished: !editableCourse?.isPublished } }),
      editableCourse?.isPublished ? 'Course unpublished.' : 'Course published - students can now enroll.',
    );

  const handleDeleteDraftCourse = async () => {
    const isDeletionConfirmed = window.confirm(
      `Delete the draft course "${editableCourse?.title}"? Its modules, lessons and assessments will be removed permanently.`,
    );
    if (!isDeletionConfirmed) return;

    setIsRunningAction(true);
    setErrorMessage(null);
    try {
      await sendApiRequest(`/instructor/courses/${courseId}`, { httpMethod: 'DELETE' });
      navigateToPage('/instructor');
    } catch (deleteError) {
      setErrorMessage(extractErrorMessage(deleteError));
      setIsRunningAction(false);
    }
  };

  const handleAddModule = (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    void runAction(async () => {
      await sendApiRequest(`/instructor/courses/${courseId}/modules`, { httpMethod: 'POST', jsonBody: { title: newModuleTitle } });
      setNewModuleTitle('');
    });
  };

  const handleAddLesson = (courseModuleId: string, submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    void runAction(async () => {
      await sendApiRequest(`/instructor/modules/${courseModuleId}/lessons`, {
        httpMethod: 'POST',
        jsonBody: { title: newLessonTitleByModuleId[courseModuleId] ?? '' },
      });
      setNewLessonTitleByModuleId((previousTitles) => ({ ...previousTitles, [courseModuleId]: '' }));
    });
  };

  const handleDeleteModule = (courseModuleId: string) => {
    if (!window.confirm('Delete this module and all of its lessons?')) return;
    void runAction(() => sendApiRequest(`/instructor/modules/${courseModuleId}`, { httpMethod: 'DELETE' }));
  };

  const handleDeleteLesson = (lessonId: string) => {
    if (!window.confirm('Delete this lesson?')) return;
    void runAction(() => sendApiRequest(`/instructor/lessons/${lessonId}`, { httpMethod: 'DELETE' }));
  };

  if (!editableCourse) {
    return <div className="page-container">{errorMessage ? <StatusMessage messageKind="error" messageText={errorMessage} /> : <LoadingIndicator />}</div>;
  }

  return (
    <div className="page-container">
      <WorkingNotice isWorking={isRunningAction} />
      <Link to="/instructor" className="muted-text">
        ← Instructor studio
      </Link>

      <div className="row-spaced">
        <h1>{editableCourse.title}</h1>
        <div className="button-row">
          {!editableCourse.isPublished && (
            <button type="button" className="button button--danger" onClick={handleDeleteDraftCourse}>
              Delete draft
            </button>
          )}
          <button type="button" className={`button ${editableCourse.isPublished ? 'button--secondary' : 'button--accent'}`} onClick={handleTogglePublished}>
            {editableCourse.isPublished ? 'Unpublish' : 'Publish course'}
          </button>
        </div>
      </div>

      <StatusMessage messageKind="error" messageText={errorMessage} />
      <StatusMessage messageKind="success" messageText={successMessage} />

      <form className="card form-stack" onSubmit={handleSaveCourseDetails}>
        <h3>Course details</h3>
        <CourseThumbnailUploader
          courseId={editableCourse.id}
          courseTitle={editableCourse.title}
          currentThumbnailImageUrl={editableCourse.thumbnailImageUrl}
          onThumbnailChanged={loadCourse}
        />
        <label className="form-field">
          <span>Title</span>
          <input value={courseTitleDraft} onChange={(changeEvent) => setCourseTitleDraft(changeEvent.target.value)} required />
        </label>
        <label className="form-field">
          <span>Description</span>
          <textarea value={courseDescriptionDraft} onChange={(changeEvent) => setCourseDescriptionDraft(changeEvent.target.value)} rows={3} required />
        </label>
        <label className="form-field">
          <span>Category</span>
          <input list="course-category-suggestions" value={courseCategoryDraft} onChange={(changeEvent) => setCourseCategoryDraft(changeEvent.target.value)} required minLength={2} maxLength={40} />
          <datalist id="course-category-suggestions">
            {SUGGESTED_COURSE_CATEGORIES.map((suggestedCategory) => (
              <option key={suggestedCategory} value={suggestedCategory} />
            ))}
          </datalist>
        </label>
        <label className="form-field">
          <span>Price in Naira (0 = free)</span>
          <input type="number" min={0} step="0.01" value={coursePriceInNairaDraft} onChange={(changeEvent) => setCoursePriceInNairaDraft(Number(changeEvent.target.value))} required />
        </label>
        <button type="submit" className="button button--primary">
          Save details
        </button>
      </form>

      <div className="card form-stack">
        <h3>Scholarship program</h3>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={editableCourse.isScholarshipAvailable}
            onChange={(changeEvent) =>
              void runAction(
                () => sendApiRequest(`/instructor/courses/${courseId}`, { httpMethod: 'PATCH', jsonBody: { isScholarshipAvailable: changeEvent.target.checked } }),
                changeEvent.target.checked ? 'This course now accepts scholarship applications.' : 'Scholarship applications are switched off for this course.',
              )
            }
          />
          <span>Offer this course in the scholarship program (approved students pay a discounted price)</span>
        </label>
        <p className="muted-text">
          Tick or untick the scholarship box on each module below to choose which sections scholarship students receive. Unticked modules stay
          locked for them.
        </p>
      </div>

      <h2>Curriculum</h2>
      <p className="muted-text">Students take lessons in this order. Each lesson unlocks after the previous one is completed.</p>

      {editableCourse.courseModules.map((courseModule) => (
        <div key={courseModule.id} className="card module-editor">
          <div className="row-spaced">
            <h3>
              Module {courseModule.sequenceOrderNumber}: {courseModule.title}
            </h3>
            <div className="button-row">
              <label className="checkbox-label" title="Scholarship students can open this module only when ticked">
                <input
                  type="checkbox"
                  checked={courseModule.isIncludedInScholarship}
                  onChange={(changeEvent) =>
                    void runAction(
                      () =>
                        sendApiRequest(`/instructor/modules/${courseModule.id}`, {
                          httpMethod: 'PATCH',
                          jsonBody: { isIncludedInScholarship: changeEvent.target.checked },
                        }),
                      changeEvent.target.checked ? 'Module added to the scholarship program.' : 'Module removed from the scholarship program.',
                    )
                  }
                />
                <span>In scholarship</span>
              </label>
              <button type="button" className="button button--danger button--small" onClick={() => handleDeleteModule(courseModule.id)}>
                Delete module
              </button>
            </div>
          </div>

          {courseModule.lessons.map((lesson) => (
            <div key={lesson.id} className="lesson-editor-row">
              <div className="row-spaced">
                <div>
                  <strong>
                    {lesson.sequenceOrderNumber}. {lesson.title}
                  </strong>{' '}
                  <span className={`badge ${lesson.cloudinaryVideoPublicId ? 'badge--success' : 'badge--warning'}`}>
                    {lesson.cloudinaryVideoPublicId ? `Video ${formatDurationInMinutesAndSeconds(lesson.videoDurationInSeconds)}` : 'No video'}
                  </span>{' '}
                  {lesson.assessment && <span className="badge badge--neutral">Quiz · pass {lesson.assessment.passMarkPercentage}%</span>}
                </div>
                <div className="button-row">
                  <LessonVideoUploader lessonId={lesson.id} hasExistingVideo={lesson.cloudinaryVideoPublicId !== null} onVideoUploaded={loadCourse} />
                  <button
                    type="button"
                    className="button button--secondary button--small"
                    onClick={() => setLessonIdWithOpenQuizEditor(lessonIdWithOpenQuizEditor === lesson.id ? null : lesson.id)}
                  >
                    {lessonIdWithOpenQuizEditor === lesson.id ? 'Close quiz' : lesson.assessment ? 'Edit quiz' : 'Add quiz'}
                  </button>
                  <button type="button" className="button button--danger button--small" onClick={() => handleDeleteLesson(lesson.id)}>
                    Delete
                  </button>
                </div>
              </div>

              {lessonIdWithOpenQuizEditor === lesson.id && <AssessmentEditor lessonId={lesson.id} onAssessmentChanged={loadCourse} />}
            </div>
          ))}

          <form className="inline-form" onSubmit={(submitEvent) => handleAddLesson(courseModule.id, submitEvent)}>
            <input
              placeholder="New lesson title"
              value={newLessonTitleByModuleId[courseModule.id] ?? ''}
              onChange={(changeEvent) => setNewLessonTitleByModuleId((previousTitles) => ({ ...previousTitles, [courseModule.id]: changeEvent.target.value }))}
              required
              minLength={2}
            />
            <button type="submit" className="button button--secondary">
              + Add lesson
            </button>
          </form>
        </div>
      ))}

      <form className="card inline-form" onSubmit={handleAddModule}>
        <input placeholder="New module title" value={newModuleTitle} onChange={(changeEvent) => setNewModuleTitle(changeEvent.target.value)} required minLength={2} />
        <button type="submit" className="button button--primary">
          + Add module
        </button>
      </form>
    </div>
  );
}
