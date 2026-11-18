import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthentication } from '../context/AuthenticationContext';
import type { UserRole } from '../types/applicationTypes';
import { LoadingIndicator } from './LoadingIndicator';

interface ProtectedRouteProps {
  allowedUserRoles?: UserRole[];
  children: ReactNode;
}

export function ProtectedRoute({ allowedUserRoles, children }: ProtectedRouteProps) {
  const { currentUser, isRestoringSession } = useAuthentication();
  const currentLocation = useLocation();

  if (isRestoringSession) return <LoadingIndicator message="Checking your session..." />;

  if (!currentUser) {
    return <Navigate to="/login" replace state={{ redirectPathAfterSignIn: currentLocation.pathname + currentLocation.search }} />;
  }

  if (allowedUserRoles && !allowedUserRoles.includes(currentUser.userRole)) {
    return (
      <div className="page-container">
        <div className="status-message status-message--error">You do not have permission to view this page.</div>
      </div>
    );
  }

  return <>{children}</>;
}
