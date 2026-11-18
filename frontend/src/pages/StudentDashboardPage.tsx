import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CourseThumbnail } from '../components/CourseThumbnail';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { ProgressBar } from '../components/ProgressBar';
import { StatusMessage } from '../components/StatusMessage';
import { extractErrorMessage, sendApiRequest } from '../services/applicationProgrammingInterfaceClient';
import type { EnrollmentSummary, PaymentStatus } from '../types/applicationTypes';
import { formatCalendarDate, formatKoboAsNaira } from '../utilities/formattingUtilities';

interface PaymentHistoryEntry {
  paymentId: string;
  courseTitle: string;
  paystackReference: string;
  amountInKobo: number;
  paymentStatus: PaymentStatus;
  createdAt: string;
}

const ACCESS_STATUS_BADGE_CLASS: Record<EnrollmentSummary['accessStatus'], string> = {
  ACTIVE: 'badge--success',
  GRACE_PERIOD: 'badge--warning',
  EXPIRED: 'badge--danger',
};

export function StudentDashboardPage() {
  const [enrollments, setEnrollments] = useState<EnrollmentSummary[] | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      sendApiRequest<{ enrollments: EnrollmentSummary[] }>('/payments/enrollments/me'),
      sendApiRequest<{ payments: PaymentHistoryEntry[] }>('/payments/me'),
    ])
      .then(([enrollmentsResponse, paymentsResponse]) => {
        setEnrollments(enrollmentsResponse.enrollments);
        setPaymentHistory(paymentsResponse.payments);
      })
      .catch((loadError) => setErrorMessage(extractErrorMessage(loadError)));
  }, []);

  return (
    <div className="page-container">
      <h1>My learning</h1>
      <StatusMessage messageKind="error" messageText={errorMessage} />
      {!enrollments && !errorMessage && <LoadingIndicator />}

      {enrollments?.length === 0 && (
        <div className="card centered-card">
          <p>You are not enrolled in any course yet.</p>
          <Link to="/courses" className="button button--primary">
            Browse courses
          </Link>
        </div>
      )}

      <div className="course-grid">
        {enrollments?.map((enrollment) => (
          <div key={enrollment.enrollmentId} className="card course-card">
            <CourseThumbnail courseTitle={enrollment.courseTitle} thumbnailImageUrl={enrollment.thumbnailImageUrl} />
            <div className="course-card__body">
              <div className="row-spaced">
                <h3>{enrollment.courseTitle}</h3>
                <span className={`badge ${ACCESS_STATUS_BADGE_CLASS[enrollment.accessStatus]}`}>{enrollment.accessStatus.replace('_', ' ')}</span>
                {enrollment.enrollmentType === 'SCHOLARSHIP' && <span className="badge badge--scholarship">Scholarship</span>}
              </div>
              <ProgressBar completionPercentage={enrollment.completionPercentage} />
              <p className="muted-text">
                {enrollment.completedLessonCount} of {enrollment.totalLessonCount} lessons · {enrollment.completionPercentage}%
              </p>
              <p className="muted-text">
                Access until {formatCalendarDate(enrollment.accessExpiresAt)}
                {enrollment.accessStatus === 'GRACE_PERIOD' && ` (grace period ends ${formatCalendarDate(enrollment.gracePeriodEndsAt)})`}
              </p>

              {enrollment.accessStatus === 'EXPIRED' ? (
                <Link to={`/courses/${enrollment.courseId}`} className="button button--accent">
                  Renew access
                </Link>
              ) : (
                <div className="button-row">
                  <Link
                    to={enrollment.nextLessonIdToWatch ? `/learn/${enrollment.courseId}/lessons/${enrollment.nextLessonIdToWatch}` : `/learn/${enrollment.courseId}`}
                    className="button button--primary"
                  >
                    {enrollment.completionPercentage === 0 ? 'Start' : enrollment.completionPercentage === 100 ? 'Review' : 'Continue'}
                  </Link>
                  {enrollment.accessStatus === 'GRACE_PERIOD' && (
                    <Link to={`/courses/${enrollment.courseId}`} className="button button--accent">
                      Renew
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {paymentHistory.length > 0 && (
        <>
          <h2>Payment history</h2>
          <div className="card table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Course</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {paymentHistory.map((payment) => (
                  <tr key={payment.paymentId}>
                    <td>{formatCalendarDate(payment.createdAt)}</td>
                    <td>{payment.courseTitle}</td>
                    <td>{formatKoboAsNaira(payment.amountInKobo)}</td>
                    <td>{payment.paymentStatus}</td>
                    <td className="monospace-text">{payment.paystackReference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
