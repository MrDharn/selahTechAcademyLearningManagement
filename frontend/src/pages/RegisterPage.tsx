import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { StatusMessage } from '../components/StatusMessage';
import { useAuthentication } from '../context/AuthenticationContext';
import { extractErrorMessage } from '../services/applicationProgrammingInterfaceClient';

export function RegisterPage() {
  const { registerStudent } = useAuthentication();
  const navigateToPage = useNavigate();
  const redirectPathAfterRegistration = (useLocation().state as { redirectPathAfterSignIn?: string } | null)?.redirectPathAfterSignIn;

  const [fullName, setFullName] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFormSubmit = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await registerStudent(fullName, emailAddress, password);
      navigateToPage(redirectPathAfterRegistration ?? '/courses', { replace: true });
    } catch (registrationError) {
      setErrorMessage(extractErrorMessage(registrationError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="authentication-page">
      <form className="card authentication-card" onSubmit={handleFormSubmit}>
        <h1>Create your account</h1>
        <p className="muted-text">Learn · Build · Grow</p>
        <StatusMessage messageKind="error" messageText={errorMessage} />

        <label className="form-field">
          <span>Full name</span>
          <input value={fullName} onChange={(changeEvent) => setFullName(changeEvent.target.value)} required minLength={2} autoComplete="name" />
        </label>

        <label className="form-field">
          <span>Email address</span>
          <input type="email" value={emailAddress} onChange={(changeEvent) => setEmailAddress(changeEvent.target.value)} required autoComplete="email" />
        </label>

        <label className="form-field">
          <span>Password (at least 8 characters)</span>
          <input type="password" value={password} onChange={(changeEvent) => setPassword(changeEvent.target.value)} required minLength={8} autoComplete="new-password" />
        </label>

        <button type="submit" className="button button--primary button--full-width" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account...' : 'Sign up'}
        </button>

        <p className="muted-text centered-text">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
