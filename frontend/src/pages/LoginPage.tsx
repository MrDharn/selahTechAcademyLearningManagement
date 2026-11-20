import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { LoadingButtonContent } from '../components/LoadingButtonContent';
import { StatusMessage } from '../components/StatusMessage';
import { useAuthentication } from '../context/AuthenticationContext';
import { extractErrorMessage } from '../services/applicationProgrammingInterfaceClient';
import type { UserRole } from '../types/applicationTypes';

const DEFAULT_LANDING_PATH_BY_USER_ROLE: Record<UserRole, string> = {
  STUDENT: '/my-learning',
  INSTRUCTOR: '/instructor',
  ADMIN: '/admin',
};

export function LoginPage() {
  const { signInWithEmailAndPassword } = useAuthentication();
  const navigateToPage = useNavigate();
  const currentLocation = useLocation();
  const redirectPathAfterSignIn = (currentLocation.state as { redirectPathAfterSignIn?: string } | null)?.redirectPathAfterSignIn;

  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFormSubmit = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const signedInUser = await signInWithEmailAndPassword(emailAddress, password);
      navigateToPage(redirectPathAfterSignIn ?? DEFAULT_LANDING_PATH_BY_USER_ROLE[signedInUser.userRole], { replace: true });
    } catch (signInError) {
      setErrorMessage(extractErrorMessage(signInError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="authentication-page">
      <form className="card authentication-card" onSubmit={handleFormSubmit}>
        <h1>Welcome back</h1>
        <p className="muted-text">Sign in to continue learning.</p>
        <StatusMessage messageKind="error" messageText={errorMessage} />

        <GoogleSignInButton
          buttonText="signin_with"
          onError={setErrorMessage}
          onSignedIn={(signedInUser) => navigateToPage(redirectPathAfterSignIn ?? DEFAULT_LANDING_PATH_BY_USER_ROLE[signedInUser.userRole], { replace: true })}
        />

        <label className="form-field">
          <span>Email address</span>
          <input type="email" value={emailAddress} onChange={(changeEvent) => setEmailAddress(changeEvent.target.value)} required autoComplete="email" />
        </label>

        <label className="form-field">
          <span>Password</span>
          <input type="password" value={password} onChange={(changeEvent) => setPassword(changeEvent.target.value)} required autoComplete="current-password" />
        </label>

        <button type="submit" className="button button--primary button--full-width" disabled={isSubmitting}>
          <LoadingButtonContent isLoading={isSubmitting} loadingText="Signing in...">
            Sign in
          </LoadingButtonContent>
        </button>

        <p className="muted-text centered-text">
          New here? <Link to="/register">Create a student account</Link>
        </p>
      </form>
    </div>
  );
}
