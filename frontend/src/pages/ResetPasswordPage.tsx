import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LoadingButtonContent } from '../components/LoadingButtonContent';
import { StatusMessage } from '../components/StatusMessage';
import { extractErrorMessage, sendApiRequest } from '../services/applicationProgrammingInterfaceClient';

export function ResetPasswordPage() {
  const [searchParameters] = useSearchParams();
  const passwordResetToken = searchParameters.get('token') ?? '';
  const navigateToPage = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFormSubmit = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    setErrorMessage(null);
    if (newPassword !== newPasswordConfirmation) {
      setErrorMessage('The two passwords do not match.');
      return;
    }
    setIsSubmitting(true);
    try {
      await sendApiRequest('/authentication/reset-password', { httpMethod: 'POST', jsonBody: { passwordResetToken, newPassword } });
      setSuccessMessage('Password changed. Taking you to sign in...');
      window.setTimeout(() => navigateToPage('/login', { replace: true }), 2500);
    } catch (resetError) {
      setErrorMessage(extractErrorMessage(resetError));
      setIsSubmitting(false);
    }
  };

  if (!passwordResetToken) {
    return (
      <div className="authentication-page">
        <div className="card authentication-card">
          <h1>Reset link not valid</h1>
          <p className="muted-text">This page needs the link from your reset e-mail. You can request a new one.</p>
          <Link to="/forgot-password" className="button button--primary button--full-width">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="authentication-page">
      <form className="card authentication-card" onSubmit={handleFormSubmit}>
        <h1>Choose a new password</h1>
        <StatusMessage messageKind="error" messageText={errorMessage} />
        <StatusMessage messageKind="success" messageText={successMessage} />

        <label className="form-field">
          <span>New password (at least 8 characters)</span>
          <input type="password" value={newPassword} onChange={(changeEvent) => setNewPassword(changeEvent.target.value)} required minLength={8} autoComplete="new-password" />
        </label>
        <label className="form-field">
          <span>Repeat the new password</span>
          <input type="password" value={newPasswordConfirmation} onChange={(changeEvent) => setNewPasswordConfirmation(changeEvent.target.value)} required minLength={8} autoComplete="new-password" />
        </label>

        <button type="submit" className="button button--primary button--full-width" disabled={isSubmitting}>
          <LoadingButtonContent isLoading={isSubmitting} loadingText="Saving">
            Change password
          </LoadingButtonContent>
        </button>

        <p className="muted-text centered-text">
          <Link to="/forgot-password">Request a new link</Link>
        </p>
      </form>
    </div>
  );
}
