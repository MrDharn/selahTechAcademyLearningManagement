import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { StatusMessage } from '../components/StatusMessage';
import { useAuthentication } from '../context/AuthenticationContext';
import { extractErrorMessage, sendApiRequest } from '../services/applicationProgrammingInterfaceClient';
import type { AdminPaymentRecord, AdminScholarshipApplication, PlatformStatistics, PublicUser, UserRole } from '../types/applicationTypes';
import { formatCalendarDate, formatKoboAsNaira } from '../utilities/formattingUtilities';

const ALL_USER_ROLES: UserRole[] = ['STUDENT', 'INSTRUCTOR', 'ADMIN'];

export function AdminDashboardPage() {
  const { currentUser } = useAuthentication();

  const [platformStatistics, setPlatformStatistics] = useState<PlatformStatistics | null>(null);
  const [allUsers, setAllUsers] = useState<PublicUser[]>([]);
  const [recentPayments, setRecentPayments] = useState<AdminPaymentRecord[]>([]);
  const [scholarshipApplications, setScholarshipApplications] = useState<AdminScholarshipApplication[]>([]);
  const [reviewerNoteByApplicationId, setReviewerNoteByApplicationId] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserEmailAddress, setNewUserEmailAddress] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('INSTRUCTOR');

  const loadAdminData = useCallback(async () => {
    try {
      const [statisticsResponse, usersResponse, paymentsResponse, scholarshipApplicationsResponse] = await Promise.all([
        sendApiRequest<PlatformStatistics>('/admin/statistics'),
        sendApiRequest<{ users: PublicUser[] }>('/admin/users'),
        sendApiRequest<{ payments: AdminPaymentRecord[] }>('/admin/payments'),
        sendApiRequest<{ applications: AdminScholarshipApplication[] }>('/admin/scholarship-applications'),
      ]);
      setScholarshipApplications(scholarshipApplicationsResponse.applications);
      setPlatformStatistics(statisticsResponse);
      setAllUsers(usersResponse.users);
      setRecentPayments(paymentsResponse.payments);
    } catch (loadError) {
      setErrorMessage(extractErrorMessage(loadError));
    }
  }, []);

  useEffect(() => {
    void loadAdminData();
  }, [loadAdminData]);

  const runAdminAction = async (actionToRun: () => Promise<unknown>, successText: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await actionToRun();
      await loadAdminData();
      setSuccessMessage(successText);
    } catch (actionError) {
      setErrorMessage(extractErrorMessage(actionError));
    }
  };

  const handleCreateUserSubmit = (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    void runAdminAction(async () => {
      await sendApiRequest('/admin/users', {
        httpMethod: 'POST',
        jsonBody: { fullName: newUserFullName, emailAddress: newUserEmailAddress, password: newUserPassword, userRole: newUserRole },
      });
      setNewUserFullName('');
      setNewUserEmailAddress('');
      setNewUserPassword('');
    }, 'Account created.');
  };

  if (!platformStatistics) {
    return <div className="page-container">{errorMessage ? <StatusMessage messageKind="error" messageText={errorMessage} /> : <LoadingIndicator />}</div>;
  }

  const statisticTiles: { label: string; value: string | number }[] = [
    { label: 'Students', value: platformStatistics.studentCount },
    { label: 'Instructors', value: platformStatistics.instructorCount },
    { label: 'Courses (published)', value: `${platformStatistics.courseCount} (${platformStatistics.publishedCourseCount})` },
    { label: 'Enrollments', value: platformStatistics.enrollmentCount },
    { label: 'Revenue', value: formatKoboAsNaira(platformStatistics.totalRevenueInKobo) },
  ];

  return (
    <div className="page-container">
      <h1>Platform administration</h1>
      <StatusMessage messageKind="error" messageText={errorMessage} />
      <StatusMessage messageKind="success" messageText={successMessage} />

      <div className="statistics-grid">
        {statisticTiles.map((tile) => (
          <div key={tile.label} className="card statistic-tile">
            <p className="muted-text">{tile.label}</p>
            <p className="statistic-tile__value">{tile.value}</p>
          </div>
        ))}
      </div>

      <h2>Scholarship applications</h2>
      {scholarshipApplications.length === 0 && <p className="muted-text">No scholarship applications yet.</p>}
      {scholarshipApplications.map((application) => (
        <div key={application.scholarshipApplicationId} className="card">
          <div className="row-spaced">
            <div>
              <strong>{application.applicantFullName}</strong> <span className="muted-text">· {application.applicantEmailAddress} · {application.phoneNumber}</span>
              <p className="muted-text">
                {application.courseTitle} · {application.currentOccupation} · applied {formatCalendarDate(application.submittedAt)}
              </p>
            </div>
            <span
              className={`badge ${application.applicationStatus === 'APPROVED' ? 'badge--success' : application.applicationStatus === 'REJECTED' ? 'badge--danger' : 'badge--warning'}`}
            >
              {application.applicationStatus}
            </span>
          </div>
          <p>{application.motivationStatement}</p>
          {application.applicationStatus === 'PENDING' ? (
            <div className="inline-form inline-form--wrap">
              <input
                placeholder="Optional note to the applicant"
                value={reviewerNoteByApplicationId[application.scholarshipApplicationId] ?? ''}
                onChange={(changeEvent) =>
                  setReviewerNoteByApplicationId((previousNotes) => ({ ...previousNotes, [application.scholarshipApplicationId]: changeEvent.target.value }))
                }
              />
              {(['APPROVED', 'REJECTED'] as const).map((decision) => (
                <button
                  key={decision}
                  type="button"
                  className={`button ${decision === 'APPROVED' ? 'button--primary' : 'button--danger'}`}
                  onClick={() =>
                    runAdminAction(
                      () =>
                        sendApiRequest(`/admin/scholarship-applications/${application.scholarshipApplicationId}`, {
                          httpMethod: 'PATCH',
                          jsonBody: { applicationStatus: decision, reviewerNote: reviewerNoteByApplicationId[application.scholarshipApplicationId] || null },
                        }),
                      `Application ${decision.toLowerCase()} for ${application.applicantFullName}.`,
                    )
                  }
                >
                  {decision === 'APPROVED' ? 'Approve' : 'Reject'}
                </button>
              ))}
            </div>
          ) : (
            application.reviewerNote && <p className="muted-text">Note: {application.reviewerNote}</p>
          )}
        </div>
      ))}

      <h2>Create an account</h2>
      <form className="card inline-form inline-form--wrap" onSubmit={handleCreateUserSubmit}>
        <input placeholder="Full name" value={newUserFullName} onChange={(changeEvent) => setNewUserFullName(changeEvent.target.value)} required />
        <input type="email" placeholder="Email address" value={newUserEmailAddress} onChange={(changeEvent) => setNewUserEmailAddress(changeEvent.target.value)} required />
        <input type="password" placeholder="Temporary password (8+ characters)" value={newUserPassword} onChange={(changeEvent) => setNewUserPassword(changeEvent.target.value)} required minLength={8} />
        <select value={newUserRole} onChange={(changeEvent) => setNewUserRole(changeEvent.target.value as UserRole)}>
          {ALL_USER_ROLES.map((userRole) => (
            <option key={userRole} value={userRole}>
              {userRole}
            </option>
          ))}
        </select>
        <button type="submit" className="button button--primary">
          Create
        </button>
      </form>

      <h2>Users</h2>
      <div className="card table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Joined</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {allUsers.map((user) => {
              const isCurrentAdministrator = user.userId === currentUser?.userId;
              return (
                <tr key={user.userId}>
                  <td>{user.fullName}</td>
                  <td>{user.emailAddress}</td>
                  <td>
                    <select
                      value={user.userRole}
                      disabled={isCurrentAdministrator}
                      onChange={(changeEvent) =>
                        runAdminAction(
                          () => sendApiRequest(`/admin/users/${user.userId}`, { httpMethod: 'PATCH', jsonBody: { userRole: changeEvent.target.value } }),
                          `Role updated for ${user.fullName}.`,
                        )
                      }
                    >
                      {ALL_USER_ROLES.map((userRole) => (
                        <option key={userRole} value={userRole}>
                          {userRole}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{formatCalendarDate(user.createdAt)}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={user.isAccountActive}
                      disabled={isCurrentAdministrator}
                      onChange={(changeEvent) =>
                        runAdminAction(
                          () => sendApiRequest(`/admin/users/${user.userId}`, { httpMethod: 'PATCH', jsonBody: { isAccountActive: changeEvent.target.checked } }),
                          `${user.fullName} is now ${changeEvent.target.checked ? 'active' : 'deactivated'}.`,
                        )
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>Recent payments</h2>
      <div className="card table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Student</th>
              <th>Course</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Reference</th>
            </tr>
          </thead>
          <tbody>
            {recentPayments.map((payment) => (
              <tr key={payment.paymentId}>
                <td>{formatCalendarDate(payment.createdAt)}</td>
                <td>
                  {payment.studentFullName}
                  <br />
                  <span className="muted-text">{payment.studentEmailAddress}</span>
                </td>
                <td>{payment.courseTitle}</td>
                <td>
                  {formatKoboAsNaira(payment.amountInKobo)}
                  {payment.isScholarshipPayment && <span className="badge badge--scholarship">Scholarship</span>}
                </td>
                <td>
                  <span className={`badge ${payment.paymentStatus === 'SUCCESSFUL' ? 'badge--success' : payment.paymentStatus === 'FAILED' ? 'badge--danger' : 'badge--warning'}`}>
                    {payment.paymentStatus}
                  </span>
                </td>
                <td className="monospace-text">{payment.paystackReference}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
