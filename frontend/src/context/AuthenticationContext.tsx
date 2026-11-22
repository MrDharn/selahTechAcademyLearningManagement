import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { sendApiRequest, readStoredAuthenticationToken, storeAuthenticationToken } from '../services/applicationProgrammingInterfaceClient';
import type { AuthenticationResponse, PublicUser } from '../types/applicationTypes';

interface AuthenticationContextValue {
  currentUser: PublicUser | null;
  isRestoringSession: boolean;
  signInWithEmailAndPassword: (emailAddress: string, password: string) => Promise<PublicUser>;
  registerStudent: (fullName: string, emailAddress: string, password: string) => Promise<PublicUser>;
  signInWithGoogleIdToken: (googleIdToken: string) => Promise<PublicUser>;
  /** Call after the profile changes (name, phone, picture) so the header shows the new details at once. */
  updateCurrentUser: (updatedUser: PublicUser) => void;
  signOut: () => void;
}

const AuthenticationContext = createContext<AuthenticationContextValue | null>(null);

export function AuthenticationProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<PublicUser | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState<boolean>(() => readStoredAuthenticationToken() !== null);

  useEffect(() => {
    if (!readStoredAuthenticationToken()) return;

    sendApiRequest<{ user: PublicUser }>('/authentication/me')
      .then((meResponse) => setCurrentUser(meResponse.user))
      .catch(() => storeAuthenticationToken(null))
      .finally(() => setIsRestoringSession(false));
  }, []);

  const handleSuccessfulAuthentication = useCallback((authenticationResponse: AuthenticationResponse) => {
    storeAuthenticationToken(authenticationResponse.authenticationToken);
    setCurrentUser(authenticationResponse.user);
    return authenticationResponse.user;
  }, []);

  const signInWithEmailAndPassword = useCallback(
    async (emailAddress: string, password: string) => {
      const authenticationResponse = await sendApiRequest<AuthenticationResponse>('/authentication/login', {
        httpMethod: 'POST',
        jsonBody: { emailAddress, password },
      });
      return handleSuccessfulAuthentication(authenticationResponse);
    },
    [handleSuccessfulAuthentication],
  );

  const registerStudent = useCallback(
    async (fullName: string, emailAddress: string, password: string) => {
      const authenticationResponse = await sendApiRequest<AuthenticationResponse>('/authentication/register', {
        httpMethod: 'POST',
        jsonBody: { fullName, emailAddress, password },
      });
      return handleSuccessfulAuthentication(authenticationResponse);
    },
    [handleSuccessfulAuthentication],
  );

  const signInWithGoogleIdToken = useCallback(
    async (googleIdToken: string) => {
      const authenticationResponse = await sendApiRequest<AuthenticationResponse>('/authentication/google', {
        httpMethod: 'POST',
        jsonBody: { googleIdToken },
      });
      return handleSuccessfulAuthentication(authenticationResponse);
    },
    [handleSuccessfulAuthentication],
  );

  const updateCurrentUser = useCallback((updatedUser: PublicUser) => setCurrentUser(updatedUser), []);

  const signOut = useCallback(() => {
    storeAuthenticationToken(null);
    setCurrentUser(null);
  }, []);

  const contextValue = useMemo(
    () => ({ currentUser, isRestoringSession, signInWithEmailAndPassword, registerStudent, signInWithGoogleIdToken, updateCurrentUser, signOut }),
    [currentUser, isRestoringSession, signInWithEmailAndPassword, registerStudent, signInWithGoogleIdToken, updateCurrentUser, signOut],
  );

  return <AuthenticationContext.Provider value={contextValue}>{children}</AuthenticationContext.Provider>;
}

export function useAuthentication(): AuthenticationContextValue {
  const authenticationContextValue = useContext(AuthenticationContext);
  if (!authenticationContextValue) throw new Error('useAuthentication must be used inside AuthenticationProvider');
  return authenticationContextValue;
}
