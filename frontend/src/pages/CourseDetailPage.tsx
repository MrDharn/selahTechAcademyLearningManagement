import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CourseThumbnail } from '../components/CourseThumbnail';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { StatusMessage } from '../components/StatusMessage';
import { useAuthentication } from '../context/AuthenticationContext';
import { extractErrorMessage, sendApiRequest } from '../services/applicationProgrammingInterfaceClient';
import type { CourseDetails, EnrollmentSummary, MyScholarshipApplication, PaymentInitializationResponse } from '../types/applicationTypes';
import { formatCalendarDate, formatDurationInMinutesAndSeconds, formatKoboAsNaira } from '../utilities/formattingUtilities';

export function CourseDetailPage() {
  const { courseId } = useParams();
  const { currentUser } = useAuthentication();
  const navigateToPage = useNavigate();

  const [courseDetails, setCourseDetails] = useState<CourseDetails | null>(null);
  const [studentEnrollmentForCourse, setStudentEnrollmentForCourse] = useState<EnrollmentSummary | null>(null);
  const [myScholarshipApplicationForCourse, setMyScholarshipApplicationForCourse] = useState<MyScholarshipApplication | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isStartingPayment, setIsStartingPayment] = useState(false);

  useEffect(() => {
    sendApiRequest<{ course: CourseDetails }>(`/courses/${courseId}`)
      .then((detailsResponse) => setCourseDetails(detailsResponse.course))
      .catch((loadError) => setErrorMessage(extractErrorMessage(loadError)));
  }, [courseId]);

  useEffect(() => {
    if (currentUser?.userRole !== 'STUDENT') return;
    sendApiRequest<{ enrollments: EnrollmentSummary[] }>('/payments/enrollments/me')
      .then((enrollmentsResponse) =>
        setStudentEnrollmentForCourse(enrollmentsResponse.enrollments.find((enrollment) => enrollment.courseId === courseId) ?? null),
      )
      .catch(() => setStudentEnrollmentForCourse(null));
  }, [currentUser, courseId]);

  useEffect(() => {
    if (currentUser?.userRole !== 'STUDENT') return;
    sendApiRequest<{ applications: MyScholarshipApplication[] }>('/scholarship/applications/me')
      .then((applicationsResponse) =>
        setMyScholarshipApplicationForCourse(applicationsResponse.applications.find((application) => application.courseId === courseId) ?? null),
      )
      .catch(() => setMyScholarshipApplicationForCourse(null));
  }, [currentUser, courseId]);

  const startPayment = async (isScholarshipPurchase: boolean) => {
    if (!currentUser) {
      navigateToPage('/login', { state: { redirectPathAfterSignIn: `/courses/${courseId}` } });
      return;
    }

    setErrorMessage(null);
    setIsStartingPayment(true);
    try {
      const paymentInitialization = await sendApiRequest<PaymentInitializationResponse>(`/payments/courses/${courseId}/initialize`, {
        httpMethod: 'POST',
        jsonBody: { isScholarshipPurchase },
      });

      if (paymentInitialization.isFreeCourseEnrollmentComplete) {
        navigateToPage('/my-learning');
      } else if (paymentInitialization.paystackAuthorizationUrl) {
        window.location.href = paymentInitialization.paystackAuthorizationUrl;
      }
    } catch (paymentError) {
      setErrorMessage(extractErrorMessage(paymentError));
      setIsStartingPayment(false);
    }
  };

  if (!courseDetails) {
    return <div className="page-container">{errorMessage ? <StatusMessage messageKind="error" messageText={errorMessage} /> : <LoadingIndicator />}</div>;
  }

  const hasUsableAccess = studentEnrollmentForCourse && studentEnrollmentForCourse.accessStatus !== 'EXPIRED';
  const isScholarshipEnrollment = studentEnrollmentForCourse?.enrollmentType === 'SCHOLARSHIP';
  const isStaffViewer = currentUser?.userRole === 'INSTRUCTOR' || currentUser?.userRole === 'ADMIN';
  const enrollButtonLabel = isScholarshipEnrollment
    ? `Upgrade to the full course · ${formatKoboAsNaira(courseDetails.priceInKobo)}`
    : studentEnrollmentForCourse
      ? 'Renew access'
      : `Enroll · ${formatKoboAsNaira(courseDetails.priceInKobo)}`;
  const shouldOfferScholarship =
    courseDetails.isScholarshipAvailable && courseDetails.priceInKobo > 0 && !isStaffViewer && studentEnrollmentForCourse?.enrollmentType !== 'STANDARD';
  const hasApprovedScholarship = myScholarshipApplicationForCourse?.applicationStatus === 'APPROVED';
  const scholarshipDiscountText = `${formatKoboAsNaira(courseDetails.scholarshipPriceInKobo)} instead of ${formatKoboAsNaira(courseDetails.priceInKobo)}`;

  return (
    <div className="page-container course-detail-layout">
      <div>
        <CourseThumbnail courseTitle={courseDetails.title} thumbnailImageUrl={courseDetails.thumbnailImageUrl} sizeVariant="banner" />
        <h1>{courseDetails.title}</h1>
        <p className="muted-text">Taught by {courseDetails.instructorFullName}</p>
        <p className="course-detail-description">{courseDetails.description}</p>

        <h2>Course content</h2>
        {courseDetails.modules.map((courseModule) => (
          <div key={courseModule.courseModuleId} className="card module-outline">
            <h3>
              {courseModule.title}{' '}
              {courseDetails.isScholarshipAvailable && courseModule.isIncludedInScholarship && <span className="badge badge--scholarship">Scholarship</span>}
            </h3>
            <ul className="lesson-outline-list">
              {courseModule.lessons.map((lesson) => (
                <li key={lesson.lessonId}>
                  <span>▶ {lesson.title}</span>
                  <span className="muted-text">{formatDurationInMinutesAndSeconds(lesson.videoDurationInSeconds)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <aside className="card enrollment-panel">
        <p className="enrollment-panel__price">{formatKoboAsNaira(courseDetails.priceInKobo)}</p>
        <StatusMessage messageKind="error" messageText={errorMessage} />

        {studentEnrollmentForCourse && (
          <StatusMessage
            messageKind={studentEnrollmentForCourse.accessStatus === 'ACTIVE' ? 'success' : 'warning'}
            messageText={
              studentEnrollmentForCourse.accessStatus === 'ACTIVE'
                ? `Your access runs until ${formatCalendarDate(studentEnrollmentForCourse.accessExpiresAt)}.`
                : studentEnrollmentForCourse.accessStatus === 'GRACE_PERIOD'
                  ? `Your paid access ended on ${formatCalendarDate(studentEnrollmentForCourse.accessExpiresAt)}. Grace period until ${formatCalendarDate(studentEnrollmentForCourse.gracePeriodEndsAt)}.`
                  : 'Your access has expired. Renew to continue.'
            }
          />
        )}

        {hasUsableAccess && (
          <Link to={`/learn/${courseDetails.courseId}`} className="button button--primary button--full-width">
            Continue learning
          </Link>
        )}

        {(!hasUsableAccess || studentEnrollmentForCourse?.accessStatus === 'GRACE_PERIOD' || isScholarshipEnrollment) && !isStaffViewer && (
          <button type="button" className="button button--accent button--full-width" onClick={() => startPayment(false)} disabled={isStartingPayment}>
            {isStartingPayment ? 'Redirecting to Paystack...' : enrollButtonLabel}
          </button>
        )}

        {isScholarshipEnrollment && (
          <StatusMessage messageKind="info" messageText="You are on the scholarship program, so you can open the sections marked Scholarship. Upgrade to unlock the rest." />
        )}

        {shouldOfferScholarship && (
          <div className="scholarship-offer-box">
            <p className="scholarship-offer-box__title">🎓 Scholarship price</p>
            <p className="scholarship-offer-box__price">{scholarshipDiscountText}</p>

            {!myScholarshipApplicationForCourse && (
              <Link to={`/scholarship?courseId=${courseDetails.courseId}`} className="button button--secondary button--full-width">
                Apply for scholarship
              </Link>
            )}
            {myScholarshipApplicationForCourse?.applicationStatus === 'PENDING' && (
              <StatusMessage messageKind="info" messageText="Your scholarship application is being reviewed." />
            )}
            {myScholarshipApplicationForCourse?.applicationStatus === 'REJECTED' && (
              <>
                <StatusMessage messageKind="warning" messageText={myScholarshipApplicationForCourse.reviewerNote ?? 'Your application was not approved this time.'} />
                <Link to={`/scholarship?courseId=${courseDetails.courseId}`} className="button button--secondary button--full-width">
                  Re-apply
                </Link>
              </>
            )}
            {hasApprovedScholarship && (
              <button type="button" className="button button--primary button--full-width" onClick={() => startPayment(true)} disabled={isStartingPayment}>
                {isScholarshipEnrollment && hasUsableAccess ? 'Renew scholarship access' : `Enroll with scholarship · ${formatKoboAsNaira(courseDetails.scholarshipPriceInKobo)}`}
              </button>
            )}
          </div>
        )}

        {!currentUser && <p className="muted-text centered-text">You will be asked to sign in first.</p>}
        <ul className="benefit-list">
          <li>✔ 3 months of access, plus a 1 month grace period</li>
          <li>✔ Secure HD streaming</li>
          <li>✔ Quizzes unlock each next lesson</li>
          <li>✔ Certificate (PDF) on completion</li>
        </ul>
      </aside>
    </div>
  );
}
