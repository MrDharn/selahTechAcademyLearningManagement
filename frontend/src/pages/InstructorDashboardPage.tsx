import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { StatusMessage } from '../components/StatusMessage';
import { useAuthentication } from '../context/AuthenticationContext';
import { extractErrorMessage, sendApiRequest } from '../services/applicationProgrammingInterfaceClient';
import type { CloudinaryAccountSummary, ManagedCourseSummary } from '../types/applicationTypes';
import { convertNairaToKobo, formatKoboAsNaira } from '../utilities/formattingUtilities';

export function InstructorDashboardPage() {
  const { currentUser } = useAuthentication();
  const navigateToPage = useNavigate();

  const [managedCourses, setManagedCourses] = useState<ManagedCourseSummary[] | null>(null);
  const [cloudinaryAccountSummary, setCloudinaryAccountSummary] = useState<CloudinaryAccountSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseDescription, setNewCourseDescription] = useState('');
  const [newCoursePriceInNaira, setNewCoursePriceInNaira] = useState(0);
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);

  const loadDashboardData = useCallback(async () => {
    try {
      const [coursesResponse, cloudinaryResponse] = await Promise.all([
        sendApiRequest<{ courses: ManagedCourseSummary[] }>('/instructor/courses'),
        sendApiRequest<CloudinaryAccountSummary>('/instructor/cloudinary-account'),
      ]);
      setManagedCourses(coursesResponse.courses);
      setCloudinaryAccountSummary(cloudinaryResponse);
    } catch (loadError) {
      setErrorMessage(extractErrorMessage(loadError));
    }
  }, []);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  const handleCreateCourseSubmit = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    setIsCreatingCourse(true);
    setErrorMessage(null);
    try {
      const { course } = await sendApiRequest<{ course: { id: string } }>('/instructor/courses', {
        httpMethod: 'POST',
        jsonBody: { title: newCourseTitle, description: newCourseDescription, priceInKobo: convertNairaToKobo(newCoursePriceInNaira) },
      });
      navigateToPage(`/instructor/courses/${course.id}`);
    } catch (createError) {
      setErrorMessage(extractErrorMessage(createError));
      setIsCreatingCourse(false);
    }
  };

  const isInstructor = currentUser?.userRole === 'INSTRUCTOR';

  return (
    <div className="page-container">
      <h1>Instructor studio</h1>
      <StatusMessage messageKind="error" messageText={errorMessage} />

      {isInstructor && cloudinaryAccountSummary && (
        <div className="card row-spaced">
          <div>
            <h3>Video storage (Cloudinary)</h3>
            <p className="muted-text">
              {cloudinaryAccountSummary.isCloudinaryAccountConnected
                ? `Connected to cloud "${cloudinaryAccountSummary.cloudinaryCloudName}". Your lesson videos are stored in your own account.`
                : 'Connect your Cloudinary account before uploading lesson videos.'}
            </p>
          </div>
          <Link to="/instructor/cloudinary" className={`button ${cloudinaryAccountSummary.isCloudinaryAccountConnected ? 'button--secondary' : 'button--accent'}`}>
            {cloudinaryAccountSummary.isCloudinaryAccountConnected ? 'Manage' : 'Connect Cloudinary'}
          </Link>
        </div>
      )}

      <h2>{currentUser?.userRole === 'ADMIN' ? 'All courses' : 'My courses'}</h2>
      {!managedCourses && !errorMessage && <LoadingIndicator />}

      <div className="course-grid">
        {managedCourses?.map((course) => (
          <Link key={course.courseId} to={`/instructor/courses/${course.courseId}`} className="card course-card">
            <div className="course-card__body">
              <div className="row-spaced">
                <h3>{course.title}</h3>
                <span className={`badge ${course.isPublished ? 'badge--success' : 'badge--neutral'}`}>{course.isPublished ? 'Published' : 'Draft'}</span>
              </div>
              <p className="muted-text">
                {formatKoboAsNaira(course.priceInKobo)} · {course.moduleCount} modules · {course.enrolledStudentCount} students
              </p>
              {currentUser?.userRole === 'ADMIN' && <p className="muted-text">Instructor: {course.instructorFullName}</p>}
            </div>
          </Link>
        ))}
      </div>

      {isInstructor && (
        <>
          <h2>Create a new course</h2>
          <form className="card form-stack" onSubmit={handleCreateCourseSubmit}>
            <label className="form-field">
              <span>Course title</span>
              <input value={newCourseTitle} onChange={(changeEvent) => setNewCourseTitle(changeEvent.target.value)} required minLength={3} />
            </label>
            <label className="form-field">
              <span>Description</span>
              <textarea value={newCourseDescription} onChange={(changeEvent) => setNewCourseDescription(changeEvent.target.value)} required minLength={10} rows={3} />
            </label>
            <label className="form-field">
              <span>Price in Naira (0 = free)</span>
              <input type="number" min={0} step="0.01" value={newCoursePriceInNaira} onChange={(changeEvent) => setNewCoursePriceInNaira(Number(changeEvent.target.value))} required />
            </label>
            <button type="submit" className="button button--primary" disabled={isCreatingCourse}>
              {isCreatingCourse ? 'Creating...' : 'Create course'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
