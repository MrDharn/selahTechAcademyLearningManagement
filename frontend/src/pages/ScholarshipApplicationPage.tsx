import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { LoadingButtonContent } from '../components/LoadingButtonContent';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { StatusMessage } from '../components/StatusMessage';
import { useAuthentication } from '../context/AuthenticationContext';
import { extractErrorMessage, sendApiRequest } from '../services/applicationProgrammingInterfaceClient';
import type { MyScholarshipApplication, ScholarshipProgramResponse } from '../types/applicationTypes';
import { formatCalendarDate, formatKoboAsNaira } from '../utilities/formattingUtilities';

const APPLICATION_STATUS_BADGE_CLASS = {
  PENDING: 'badge--warning',
  APPROVED: 'badge--success',
  REJECTED: 'badge--danger',
} as const;

export function ScholarshipApplicationPage() {
  const { currentUser, isRestoringSession } = useAuthentication();
  const [searchParameters] = useSearchParams();
  const currentLocation = useLocation();
  const redirectStateForAuthenticationPages = { redirectPathAfterSignIn: currentLocation.pathname + currentLocation.search };

  const [scholarshipProgram, setScholarshipProgram] = useState<ScholarshipProgramResponse | null>(null);
  const [myApplications, setMyApplications] = useState<MyScholarshipApplication[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedCourseId, setSelectedCourseId] = useState(searchParameters.get('courseId') ?? '');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [currentOccupation, setCurrentOccupation] = useState('');
  const [motivationStatement, setMotivationStatement] = useState('');

  const loadMyApplications = () =>
    sendApiRequest<{ applications: MyScholarshipApplication[] }>('/scholarship/applications/me')
      .then((applicationsResponse) => setMyApplications(applicationsResponse.applications))
      .catch((loadError) => setErrorMessage(extractErrorMessage(loadError)));

  useEffect(() => {
    sendApiRequest<ScholarshipProgramResponse>('/scholarship/courses')
      .then(setScholarshipProgram)
      .catch((loadError) => setErrorMessage(extractErrorMessage(loadError)));
  }, []);

  useEffect(() => {
    if (currentUser?.userRole === 'STUDENT') void loadMyApplications();
  }, [currentUser]);

  const selectedCourseOffer = scholarshipProgram?.courses.find((courseOffer) => courseOffer.courseId === selectedCourseId);
  const courseIdsAlreadyAppliedFor = new Set(myApplications.filter((application) => application.applicationStatus !== 'REJECTED').map((application) => application.courseId));

  const handleSubmitApplication = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      await sendApiRequest('/scholarship/applications', {
        httpMethod: 'POST',
        jsonBody: { courseId: selectedCourseId, phoneNumber, currentOccupation, motivationStatement },
      });
      setSuccessMessage('Application sent. We will review it and update the status below.');
      setMotivationStatement('');
      await loadMyApplications();
    } catch (submissionError) {
      setErrorMessage(extractErrorMessage(submissionError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const discountPercentage = scholarshipProgram?.scholarshipDiscountPercentage ?? 50;

  return (
    <div className="page-container narrow-page scholarship-page">
      <h1>Scholarship program</h1>
      <p className="muted-text">
        Approved applicants pay <strong>{discountPercentage}% less</strong> than the normal course price. Scholarship students receive the sections
        their instructor has included in the program.
      </p>

      <ol className="scholarship-steps">
        <li>Apply for the course you want</li>
        <li>Our team reviews your application</li>
        <li>Once approved, enroll at the discounted price</li>
      </ol>

      <StatusMessage messageKind="error" messageText={errorMessage} />
      <StatusMessage messageKind="success" messageText={successMessage} />

      {!scholarshipProgram && !errorMessage && <LoadingIndicator />}
      {scholarshipProgram?.courses.length === 0 && (
        <StatusMessage messageKind="info" messageText="No courses are open for scholarship applications right now. Please check back soon." />
      )}

      {isRestoringSession ? (
        <LoadingIndicator message="Checking your session..." />
      ) : !currentUser ? (
        <div className="card centered-card">
          <p>Create a student account (or sign in) to apply.</p>
          <div className="button-row scholarship-auth-buttons">
            <Link to="/register" state={redirectStateForAuthenticationPages} className="button button--primary">
              Create account
            </Link>
            <Link to="/login" state={redirectStateForAuthenticationPages} className="button button--secondary">
              Sign in
            </Link>
          </div>
        </div>
      ) : currentUser.userRole !== 'STUDENT' ? (
        <StatusMessage messageKind="info" messageText="Scholarship applications are made from a student account." />
      ) : (
        scholarshipProgram &&
        scholarshipProgram.courses.length > 0 && (
          <form className="card form-stack" onSubmit={handleSubmitApplication}>
            <h2>Apply now</h2>

            <label className="form-field">
              <span>Course</span>
              <select value={selectedCourseId} onChange={(changeEvent) => setSelectedCourseId(changeEvent.target.value)} required>
                <option value="">Choose a course</option>
                {scholarshipProgram.courses.map((courseOffer) => (
                  <option key={courseOffer.courseId} value={courseOffer.courseId} disabled={courseIdsAlreadyAppliedFor.has(courseOffer.courseId)}>
                    {courseOffer.title}
                    {courseIdsAlreadyAppliedFor.has(courseOffer.courseId) ? ' (already applied)' : ''}
                  </option>
                ))}
              </select>
            </label>

            {selectedCourseOffer && (
              <div className="scholarship-offer-box">
                <p className="scholarship-offer-box__price">
                  {formatKoboAsNaira(selectedCourseOffer.scholarshipPriceInKobo)} <s className="muted-text">{formatKoboAsNaira(selectedCourseOffer.fullPriceInKobo)}</s>
                </p>
                <p className="muted-text">
                  Included: {selectedCourseOffer.includedModuleTitles.length} of {selectedCourseOffer.totalModuleCount} sections
                </p>
                <ul className="scholarship-included-list">
                  {selectedCourseOffer.includedModuleTitles.map((moduleTitle) => (
                    <li key={moduleTitle}>✔ {moduleTitle}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="form-row">
              <label className="form-field form-field--grow">
                <span>Phone number</span>
                <input type="tel" value={phoneNumber} onChange={(changeEvent) => setPhoneNumber(changeEvent.target.value)} required minLength={7} />
              </label>
              <label className="form-field form-field--grow">
                <span>Current occupation</span>
                <input value={currentOccupation} onChange={(changeEvent) => setCurrentOccupation(changeEvent.target.value)} required minLength={2} />
              </label>
            </div>

            <label className="form-field">
              <span>Why do you need this scholarship?</span>
              <textarea
                rows={5}
                value={motivationStatement}
                onChange={(changeEvent) => setMotivationStatement(changeEvent.target.value)}
                required
                minLength={30}
                placeholder="Tell us about your goals and how this course will help you."
              />
            </label>

            <button type="submit" className="button button--primary" disabled={isSubmitting || !selectedCourseId}>
              <LoadingButtonContent isLoading={isSubmitting} loadingText="Sending...">
                Submit application
              </LoadingButtonContent>
            </button>
          </form>
        )
      )}

      {myApplications.length > 0 && (
        <>
          <h2>My applications</h2>
          {myApplications.map((application) => (
            <div key={application.scholarshipApplicationId} className="card">
              <div className="row-spaced">
                <strong>{application.courseTitle}</strong>
                <span className={`badge ${APPLICATION_STATUS_BADGE_CLASS[application.applicationStatus]}`}>{application.applicationStatus}</span>
              </div>
              <p className="muted-text">Applied {formatCalendarDate(application.submittedAt)}</p>
              {application.reviewerNote && <p className="muted-text">Note: {application.reviewerNote}</p>}
              {application.applicationStatus === 'APPROVED' && (
                <Link to={`/courses/${application.courseId}`} className="button button--primary">
                  Enroll for {formatKoboAsNaira(application.scholarshipPriceInKobo)}
                </Link>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
