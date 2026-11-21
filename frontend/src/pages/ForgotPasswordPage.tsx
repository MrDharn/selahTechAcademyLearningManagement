import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { LoadingButtonContent } from '../components/LoadingButtonContent';
import { StatusMessage } from '../components/StatusMessage';
import { extractErrorMessage, sendApiRequest } from '../services/applicationProgrammingInterfaceClient';

export function ForgotPasswordPage() {
  const [emailAddress, setEmailAddress] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wasResetLinkRequested, setWasResetLinkRequested] = useState(false);

  const handleFormSubmit = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await sendApiRequest('/authentication/forgot-password', { httpMethod: 'POST', jsonBody: { emailAddress } });
      setWasResetLinkRequested(true);
    } catch (requestError) {
      setErrorMessage(extractErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (wasResetLinkRequested) {
    return (
      <div className="authentication-page">
        <div className="card authentication-card">
          <h1>Check your e-mail</h1>
          <p className="muted-text">
            If an account exists for <strong>{emailAddress}</strong>, we have sent a link to choose a new password. The link works once and expires in 1 hour.
          </p>
          <Link to="/login" className="button button--primary button--full-width">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="authentication-page">
      <form className="card authentication-card" onSubmit={handleFormSubmit}>
        <h1>Forgot your password?</h1>
        <p className="muted-text">Enter your e-mail address and we will send you a link to choose a new one.</p>
        <StatusMessage messageKind="error" messageText={errorMessage} />

        <label className="form-field">
          <span>Email address</span>
          <input type="email" value={emailAddress} onChange={(changeEvent) => setEmailAddress(changeEvent.target.value)} required autoComplete="email" />
        </label>

        <button type="submit" className="button button--primary button--full-width" disabled={isSubmitting}>
          <LoadingButtonContent isLoading={isSubmitting} loadingText="Sending">
            Send reset link
          </LoadingButtonContent>
        </button>

        <p className="muted-text centered-text">
          <Link to="/login">Back to sign in</Link>
        </p>
      </form>
    </div>
  );
}
