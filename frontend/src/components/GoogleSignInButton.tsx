import { useEffect, useRef, useState } from 'react';
import { useAuthentication } from '../context/AuthenticationContext';
import { SelahTechSpinner } from './SelahTechSpinner';
import { extractErrorMessage, sendApiRequest } from '../services/applicationProgrammingInterfaceClient';
import type { GoogleSignInConfiguration, PublicUser } from '../types/applicationTypes';

// Minimal typing for the parts of Google Identity Services that we use.
interface GoogleIdentityServices {
  accounts: {
    id: {
      initialize: (options: { client_id: string; callback: (credentialResponse: { credential?: string }) => void }) => void;
      renderButton: (container: HTMLElement, options: Record<string, string | number>) => void;
    };
  };
}
declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

const GOOGLE_IDENTITY_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

function loadGoogleIdentityScript(): Promise<void> {
  return new Promise((resolveScriptLoaded, rejectScriptLoading) => {
    if (window.google?.accounts) return resolveScriptLoaded();

    const existingScriptElement = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_IDENTITY_SCRIPT_URL}"]`);
    const scriptElement = existingScriptElement ?? document.createElement('script');
    scriptElement.addEventListener('load', () => resolveScriptLoaded());
    scriptElement.addEventListener('error', () => rejectScriptLoading(new Error('Could not load Google sign-in.')));
    if (!existingScriptElement) {
      scriptElement.src = GOOGLE_IDENTITY_SCRIPT_URL;
      scriptElement.async = true;
      document.head.appendChild(scriptElement);
    }
  });
}

interface GoogleSignInButtonProps {
  buttonText: 'signin_with' | 'signup_with' | 'continue_with';
  onSignedIn: (signedInUser: PublicUser) => void;
  onError: (errorMessage: string) => void;
}

/** Renders Google's own button. It stays hidden when the server has no GOOGLE_CLIENT_ID, so the app works without it. */
export function GoogleSignInButton({ buttonText, onSignedIn, onError }: GoogleSignInButtonProps) {
  const { signInWithGoogleIdToken } = useAuthentication();
  const buttonContainerReference = useRef<HTMLDivElement>(null);
  const [isGoogleSignInAvailable, setIsGoogleSignInAvailable] = useState(false);
  const [isVerifyingWithServer, setIsVerifyingWithServer] = useState(false);

  // Keep the latest callbacks without re-initialising Google every render.
  const latestCallbacksReference = useRef({ onSignedIn, onError, signInWithGoogleIdToken });
  latestCallbacksReference.current = { onSignedIn, onError, signInWithGoogleIdToken };

  useEffect(() => {
    let wasComponentRemoved = false;

    const setUpGoogleButton = async () => {
      try {
        const googleConfiguration = await sendApiRequest<GoogleSignInConfiguration>('/authentication/google-configuration');
        if (!googleConfiguration.isGoogleSignInEnabled || !googleConfiguration.googleClientId) return;

        await loadGoogleIdentityScript();
        if (wasComponentRemoved || !window.google || !buttonContainerReference.current) return;

        window.google.accounts.id.initialize({
          client_id: googleConfiguration.googleClientId,
          callback: async (credentialResponse) => {
            if (!credentialResponse.credential) {
              latestCallbacksReference.current.onError('Google did not return a sign-in token. Please try again.');
              return;
            }
            setIsVerifyingWithServer(true);
            try {
              const signedInUser = await latestCallbacksReference.current.signInWithGoogleIdToken(credentialResponse.credential);
              latestCallbacksReference.current.onSignedIn(signedInUser);
            } catch (googleSignInError) {
              latestCallbacksReference.current.onError(extractErrorMessage(googleSignInError));
            } finally {
              setIsVerifyingWithServer(false);
            }
          },
        });

        const availableButtonWidth = Math.min(buttonContainerReference.current.clientWidth || 320, 400);
        window.google.accounts.id.renderButton(buttonContainerReference.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: buttonText,
          logo_alignment: 'left',
          width: availableButtonWidth,
        });
        setIsGoogleSignInAvailable(true);
      } catch {
        // Google blocked or unreachable (offline, ad blocker): the normal e-mail form still works, so stay silent.
      }
    };

    void setUpGoogleButton();
    return () => {
      wasComponentRemoved = true;
    };
  }, [buttonText]);

  return (
    <div className="google-sign-in" hidden={!isGoogleSignInAvailable}>
      <div ref={buttonContainerReference} className="google-sign-in__button" hidden={isVerifyingWithServer} />
      {isVerifyingWithServer && (
        <div className="google-sign-in__verifying">
          <SelahTechSpinner spinnerSize="small" />
          <span className="visually-hidden">Signing you in with Google</span>
        </div>
      )}
      <div className="google-sign-in__divider">
        <span>or use your e-mail</span>
      </div>
    </div>
  );
}
