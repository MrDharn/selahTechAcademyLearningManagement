import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CourseReviewsSection } from '../components/CourseReviewsSection';
import { CourseThumbnail } from '../components/CourseThumbnail';
import { StarRatingDisplay } from '../components/StarRating';
import { LoadingButtonContent } from '../components/LoadingButtonContent';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { StatusMessage } from '../components/StatusMessage';
import { useAuthentication } from '../context/AuthenticationContext';
import { extractErrorMessage, sendApiRequest } from '../services/applicationProgrammingInterfaceClient';
import type { CourseDetails, CoursePurchaseQuote, EnrollmentSummary, MyScholarshipApplication, PaymentInitializationResponse } from '../types/applicationTypes';
import { formatCalendarDate, formatDurationInMinutesAndSeconds, formatKoboAsNaira } from '../utilities/formattingUtilities';

export function CourseDetailPage() {
  const { courseId } = useParams();
  const { currentUser } = useAuthentication();
  const navigateToPage = useNavigate();

  const [courseDetails, setCourseDetails] = useState<CourseDetails | null>(null);
  const [studentEnrollmentForCourse, setStudentEnrollmentForCourse] = useState<EnrollmentSummary | null>(null);
  const [myScholarshipApplicationForCourse, setMyScholarshipApplicationForCourse] = useState<MyScholarshipApplication | null>(null);
  const [standardPurchaseQuote, setStandardPurchaseQuote] = useState<CoursePurchaseQuote | null>(null);
  const [scholarshipPurchaseQuote, setScholarshipPurchaseQuote] = useState<CoursePurchaseQuote | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isStartingPayment, setIsStartingPayment] = useState(false);

  const loadCourseDetails = useCallback(() => {
    sendApiRequest<{ course: CourseDetails }>(`/courses/${courseId}`)
      .then((detailsResponse) => setCourseDetails(detailsResponse.course))
      .catch((loadError) => setErrorMessage(extractErrorMessage(loadError)));
  }, [courseId]);

  useEffect(() => {
    loadCourseDetails();
  }, [loadCourseDetails]);

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

  // The price depends on progress for a student who already has the course, so ask the server (it uses the same rule as the payment).
  useEffect(() => {
    setStandardPurchaseQuote(null);
    if (currentUser?.userRole !== 'STUDENT' || !studentEnrollmentForCourse) return;
    sendApiRequest<CoursePurchaseQuote>(`/payments/courses/${courseId}/quote`)
      .then(setStandardPurchaseQuote)
      .catch(() => setStandardPurchaseQuote(null));
  }, [currentUser, courseId, studentEnrollmentForCourse]);

  useEffect(() => {
    setScholarshipPurchaseQuote(null);
    const isApprovedScholarshipEnrollment =
      studentEnrollmentForCourse?.enrollmentType === 'SCHOLARSHIP' && myScholarshipApplicationForCourse?.applicationStatus === 'APPROVED';
    if (currentUser?.userRole !== 'STUDENT' || !isApprovedScholarshipEnrollment) return;
    sendApiRequest<CoursePurchaseQuote>(`/payments/courses/${courseId}/quote?isScholarshipPurchase=true`)
      .then(setScholarshipPurchaseQuote)
      .catch(() => setScholarshipPurchaseQuote(null));
  }, [currentUser, courseId, studentEnrollmentForCourse, myScholarshipApplicationForCourse]);

  const startPayment = async (isScholarshipPurchase: boolean) => {
    const quoteBeingPaid = isScholarshipPurchase ? scholarshipPurchaseQuote : standardPurchaseQuote;
    if (quoteBeingPaid?.purchaseKind === 'RETAKE' && !window.confirm('Retaking restarts your progress from the first lesson. Your certificate is kept. Continue?')) return;

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
  // The reminder e-mail goes out 7 days before access ends, so the Renew button must already be there (extra time is added on top).
  const DAYS_BEFORE_EXPIRY_WHEN_RENEWAL_OPENS = 14;
  const isAccessEndingSoon =
    studentEnrollmentForCourse?.accessStatus === 'ACTIVE' &&
    new Date(studentEnrollmentForCourse.accessExpiresAt).getTime() - Date.now() <= DAYS_BEFORE_EXPIRY_WHEN_RENEWAL_OPENS * 24 * 60 * 60 * 1000;
  const isStaffViewer = currentUser?.userRole === 'INSTRUCTOR' || currentUser?.userRole === 'ADMIN';
  const describePurchaseQuoteAsButtonLabel = (purchaseQuote: CoursePurchaseQuote | null, fallbackLabel: string) =>
    purchaseQuote?.purchaseKind === 'RETAKE'
      ? `Retake course · ${formatKoboAsNaira(purchaseQuote.amountInKobo)}`
      : purchaseQuote?.purchaseKind === 'RENEWAL'
        ? `Renew access · ${formatKoboAsNaira(purchaseQuote.amountInKobo)}`
        : fallbackLabel;
  const describePurchaseQuoteAsExplanation = (purchaseQuote: CoursePurchaseQuote | null) =>
    purchaseQuote?.purchaseKind === 'RETAKE'
      ? 'You have completed 100% of this course. Retaking restarts your progress from the first lesson; your certificate is kept.'
      : purchaseQuote?.purchaseKind === 'RENEWAL' && purchaseQuote.completionPercentage !== null
        ? `You have covered ${purchaseQuote.completionPercentage}% of this course, so you pay half of the remaining ${100 - purchaseQuote.completionPercentage}%.`
        : null;
  const enrollButtonLabel = isScholarshipEnrollment
    ? `Upgrade to the full course · ${formatKoboAsNaira(courseDetails.priceInKobo)}`
    : studentEnrollmentForCourse
      ? describePurchaseQuoteAsButtonLabel(standardPurchaseQuote, 'Renew access')
      : `Enroll · ${formatKoboAsNaira(courseDetails.priceInKobo)}`;
  const isRetakeAvailable = standardPurchaseQuote?.purchaseKind === 'RETAKE' && !isScholarshipEnrollment;
  // The discounted price is never shown to the public. It only appears to a student who applied and was approved,
  // so a visitor browsing the catalogue only ever sees the normal price.
  const shouldShowScholarshipStatus = Boolean(myScholarshipApplicationForCourse) && !isStaffViewer && studentEnrollmentForCourse?.enrollmentType !== 'STANDARD';
  const hasApprovedScholarship = myScholarshipApplicationForCourse?.applicationStatus === 'APPROVED';

  return (
    <div className="page-container course-detail-layout">
      <div>
        <CourseThumbnail courseTitle={courseDetails.title} thumbnailImageUrl={courseDetails.thumbnailImageUrl} sizeVariant="banner" />
        <h1>{courseDetails.title}</h1>
        <p className="muted-text">
          <span className="category-badge">{courseDetails.category}</span> Taught by {courseDetails.instructorFullName}
        </p>
        <StarRatingDisplay averageRating={courseDetails.averageRating} reviewCount={courseDetails.reviewCount} />
        <p className="course-detail-description">{courseDetails.description}</p>

        <h2>Course content</h2>
        {courseDetails.modules.map((courseModule) => (
          <div key={courseModule.courseModuleId} className="card module-outline">
            <h3>{courseModule.title}</h3>
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

        <CourseReviewsSection courseId={courseDetails.courseId} canWriteReview={Boolean(studentEnrollmentForCourse)} onReviewsChanged={loadCourseDetails} />
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

        {(!hasUsableAccess || studentEnrollmentForCourse?.accessStatus === 'GRACE_PERIOD' || isAccessEndingSoon || isRetakeAvailable || isScholarshipEnrollment) && !isStaffViewer && (
          <button type="button" className="button button--accent button--full-width" onClick={() => startPayment(false)} disabled={isStartingPayment}>
            <LoadingButtonContent isLoading={isStartingPayment} loadingText="Redirecting to Paystack...">
              {enrollButtonLabel}
            </LoadingButtonContent>
          </button>
        )}
        {!isScholarshipEnrollment && !isStaffViewer && describePurchaseQuoteAsExplanation(standardPurchaseQuote) && (
          <p className="muted-text">{describePurchaseQuoteAsExplanation(standardPurchaseQuote)}</p>
        )}

        {isScholarshipEnrollment && (
          <StatusMessage messageKind="info" messageText="You are on the scholarship program, so you can open the sections included in it. Upgrade to the full course to unlock the rest." />
        )}

        {shouldShowScholarshipStatus && myScholarshipApplicationForCourse && (
          <div className="scholarship-offer-box">
            <p className="scholarship-offer-box__title">🎓 Your scholarship</p>
            {hasApprovedScholarship && (
              <p className="scholarship-offer-box__price">Approved price: {formatKoboAsNaira(myScholarshipApplicationForCourse.scholarshipPriceInKobo)}</p>
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
                <LoadingButtonContent isLoading={isStartingPayment} loadingText="Redirecting to Paystack...">
                  {isScholarshipEnrollment
                    ? describePurchaseQuoteAsButtonLabel(scholarshipPurchaseQuote, 'Renew scholarship access')
                    : `Enroll with scholarship · ${formatKoboAsNaira(myScholarshipApplicationForCourse.scholarshipPriceInKobo)}`}
                </LoadingButtonContent>
              </button>
            )}
            {hasApprovedScholarship && isScholarshipEnrollment && describePurchaseQuoteAsExplanation(scholarshipPurchaseQuote) && (
              <p className="muted-text">{describePurchaseQuoteAsExplanation(scholarshipPurchaseQuote)}</p>
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
