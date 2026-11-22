import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { LoadingButtonContent } from '../components/LoadingButtonContent';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { StatusMessage } from '../components/StatusMessage';
import { UserAvatar } from '../components/UserAvatar';
import { useAuthentication } from '../context/AuthenticationContext';
import { extractErrorMessage, sendApiRequest } from '../services/applicationProgrammingInterfaceClient';
import type { MyAccountResponse, PublicUser } from '../types/applicationTypes';
import { formatCalendarDate } from '../utilities/formattingUtilities';
import { resizeImageFileToSquareJpegDataUrl } from '../utilities/imageResizingUtilities';

const ACCESS_STATUS_LABELS = { ACTIVE: 'Active', GRACE_PERIOD: 'Grace period', EXPIRED: 'Expired' } as const;
const ACCESS_STATUS_BADGE_CLASSES = { ACTIVE: 'badge--success', GRACE_PERIOD: 'badge--neutral', EXPIRED: 'badge--danger' } as const;

export function SettingsPage() {
  const { updateCurrentUser } = useAuthentication();

  const [myAccount, setMyAccount] = useState<MyAccountResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [fullNameDraft, setFullNameDraft] = useState('');
  const [phoneNumberDraft, setPhoneNumberDraft] = useState('');
  const [currentPasswordDraft, setCurrentPasswordDraft] = useState('');
  const [newPasswordDraft, setNewPasswordDraft] = useState('');
  const [newPasswordConfirmationDraft, setNewPasswordConfirmationDraft] = useState('');

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUpdatingPicture, setIsUpdatingPicture] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const pictureFileInputReference = useRef<HTMLInputElement>(null);

  useEffect(() => {
    sendApiRequest<MyAccountResponse>('/account')
      .then((accountResponse) => {
        setMyAccount(accountResponse);
        setFullNameDraft(accountResponse.user.fullName);
        setPhoneNumberDraft(accountResponse.user.phoneNumber ?? '');
      })
      .catch((loadError) => setErrorMessage(extractErrorMessage(loadError)));
  }, []);

  const showUpdatedUser = (updatedUser: PublicUser) => {
    updateCurrentUser(updatedUser);
    setMyAccount((previousAccount) => (previousAccount ? { ...previousAccount, user: updatedUser } : previousAccount));
  };

  const resetMessages = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleSaveProfile = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    resetMessages();
    setIsSavingProfile(true);
    try {
      const { user } = await sendApiRequest<{ user: PublicUser }>('/account/profile', {
        httpMethod: 'PATCH',
        jsonBody: { fullName: fullNameDraft, phoneNumber: phoneNumberDraft },
      });
      showUpdatedUser(user);
      setPhoneNumberDraft(user.phoneNumber ?? '');
      setSuccessMessage('Profile saved.');
    } catch (saveError) {
      setErrorMessage(extractErrorMessage(saveError));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePictureChosen = async (changeEvent: ChangeEvent<HTMLInputElement>) => {
    const chosenFile = changeEvent.target.files?.[0];
    changeEvent.target.value = ''; // lets the same file be chosen again later
    if (!chosenFile) return;

    resetMessages();
    setIsUpdatingPicture(true);
    try {
      const profilePictureDataUrl = await resizeImageFileToSquareJpegDataUrl(chosenFile);
      const { user } = await sendApiRequest<{ user: PublicUser }>('/account/profile-picture', { httpMethod: 'PUT', jsonBody: { profilePictureDataUrl } });
      showUpdatedUser(user);
      setSuccessMessage('Profile picture updated.');
    } catch (pictureError) {
      setErrorMessage(extractErrorMessage(pictureError));
    } finally {
      setIsUpdatingPicture(false);
    }
  };

  const handleRemovePicture = async () => {
    resetMessages();
    setIsUpdatingPicture(true);
    try {
      const { user } = await sendApiRequest<{ user: PublicUser }>('/account/profile-picture', { httpMethod: 'DELETE' });
      showUpdatedUser(user);
      setSuccessMessage('Profile picture removed.');
    } catch (removeError) {
      setErrorMessage(extractErrorMessage(removeError));
    } finally {
      setIsUpdatingPicture(false);
    }
  };

  const handleChangePassword = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    resetMessages();
    if (newPasswordDraft !== newPasswordConfirmationDraft) {
      setErrorMessage('The two new passwords do not match.');
      return;
    }
    setIsChangingPassword(true);
    try {
      await sendApiRequest('/account/password', {
        httpMethod: 'PUT',
        jsonBody: { currentPassword: currentPasswordDraft || undefined, newPassword: newPasswordDraft },
      });
      setCurrentPasswordDraft('');
      setNewPasswordDraft('');
      setNewPasswordConfirmationDraft('');
      setMyAccount((previousAccount) => (previousAccount ? { ...previousAccount, hasPassword: true } : previousAccount));
      setSuccessMessage('Password changed.');
    } catch (passwordError) {
      setErrorMessage(extractErrorMessage(passwordError));
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (!myAccount) {
    return <div className="page-container">{errorMessage ? <StatusMessage messageKind="error" messageText={errorMessage} /> : <LoadingIndicator />}</div>;
  }

  return (
    <div className="page-container settings-page">
      <h1>Settings</h1>
      <StatusMessage messageKind="error" messageText={errorMessage} />
      <StatusMessage messageKind="success" messageText={successMessage} />

      <section className="card settings-section">
        <h2>Profile picture</h2>
        <div className="settings-picture-row">
          <UserAvatar user={myAccount.user} avatarSize="large" />
          <div className="button-row">
            <input ref={pictureFileInputReference} type="file" accept="image/*" hidden onChange={handlePictureChosen} />
            <button type="button" className="button button--primary" disabled={isUpdatingPicture} onClick={() => pictureFileInputReference.current?.click()}>
              <LoadingButtonContent isLoading={isUpdatingPicture} loadingText="Updating picture">
                {myAccount.user.profilePictureDataUrl ? 'Change picture' : 'Upload picture'}
              </LoadingButtonContent>
            </button>
            {myAccount.user.profilePictureDataUrl && (
              <button type="button" className="button button--secondary" disabled={isUpdatingPicture} onClick={handleRemovePicture}>
                Remove
              </button>
            )}
          </div>
        </div>
        <p className="muted-text">Any photo works. It is cropped to a square and shrunk automatically.</p>
      </section>

      <form className="card settings-section form-stack" onSubmit={handleSaveProfile}>
        <h2>Profile details</h2>
        <label className="form-field">
          <span>Full name</span>
          <input value={fullNameDraft} onChange={(changeEvent) => setFullNameDraft(changeEvent.target.value)} required minLength={2} maxLength={100} autoComplete="name" />
        </label>
        <label className="form-field">
          <span>Phone number</span>
          <input type="tel" value={phoneNumberDraft} onChange={(changeEvent) => setPhoneNumberDraft(changeEvent.target.value)} placeholder="+2348012345678" autoComplete="tel" />
        </label>
        <label className="form-field">
          <span>Email address (cannot be changed)</span>
          <input value={myAccount.user.emailAddress} disabled />
        </label>
        <button type="submit" className="button button--primary" disabled={isSavingProfile}>
          <LoadingButtonContent isLoading={isSavingProfile} loadingText="Saving">
            Save profile
          </LoadingButtonContent>
        </button>
      </form>

      <form className="card settings-section form-stack" onSubmit={handleChangePassword}>
        <h2>{myAccount.hasPassword ? 'Change password' : 'Set a password'}</h2>
        {!myAccount.hasPassword && <p className="muted-text">You signed up with Google. Set a password if you also want to sign in with your e-mail address.</p>}
        {myAccount.hasPassword && (
          <label className="form-field">
            <span>Current password</span>
            <input type="password" value={currentPasswordDraft} onChange={(changeEvent) => setCurrentPasswordDraft(changeEvent.target.value)} required autoComplete="current-password" />
          </label>
        )}
        <label className="form-field">
          <span>New password (at least 8 characters)</span>
          <input type="password" value={newPasswordDraft} onChange={(changeEvent) => setNewPasswordDraft(changeEvent.target.value)} required minLength={8} autoComplete="new-password" />
        </label>
        <label className="form-field">
          <span>Repeat the new password</span>
          <input type="password" value={newPasswordConfirmationDraft} onChange={(changeEvent) => setNewPasswordConfirmationDraft(changeEvent.target.value)} required minLength={8} autoComplete="new-password" />
        </label>
        <button type="submit" className="button button--primary" disabled={isChangingPassword}>
          <LoadingButtonContent isLoading={isChangingPassword} loadingText="Saving">
            {myAccount.hasPassword ? 'Change password' : 'Set password'}
          </LoadingButtonContent>
        </button>
      </form>

      <section className="card settings-section">
        <h2>Enrolled courses</h2>
        {myAccount.enrolledCourses.length === 0 ? (
          <p className="muted-text">
            You are not enrolled in any course yet. <Link to="/courses">Browse courses</Link>
          </p>
        ) : (
          <ul className="enrolled-course-list">
            {myAccount.enrolledCourses.map((enrolledCourse) => (
              <li key={enrolledCourse.courseId} className="enrolled-course-list__item">
                <div>
                  <strong>{enrolledCourse.courseTitle}</strong>
                  <p className="muted-text">
                    {enrolledCourse.enrollmentType === 'SCHOLARSHIP' ? 'Scholarship · ' : ''}
                    {enrolledCourse.courseAccessStatus === 'EXPIRED'
                      ? `Access ended ${formatCalendarDate(enrolledCourse.gracePeriodEndsAt)}`
                      : enrolledCourse.courseAccessStatus === 'GRACE_PERIOD'
                        ? `Renew by ${formatCalendarDate(enrolledCourse.gracePeriodEndsAt)}`
                        : `Access until ${formatCalendarDate(enrolledCourse.accessExpiresAt)}`}
                  </p>
                </div>
                <div className="button-row">
                  <span className={`badge ${ACCESS_STATUS_BADGE_CLASSES[enrolledCourse.courseAccessStatus]}`}>{ACCESS_STATUS_LABELS[enrolledCourse.courseAccessStatus]}</span>
                  <Link
                    to={enrolledCourse.courseAccessStatus === 'EXPIRED' ? `/courses/${enrolledCourse.courseId}` : `/learn/${enrolledCourse.courseId}`}
                    className="button button--secondary button--small"
                  >
                    {enrolledCourse.courseAccessStatus === 'EXPIRED' ? 'Renew' : 'Open'}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
