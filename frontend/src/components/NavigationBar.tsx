import { useEffect, useState, type MouseEvent } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuthentication } from '../context/AuthenticationContext';

export function NavigationBar() {
  const { currentUser, signOut } = useAuthentication();
  const navigateToPage = useNavigate();
  const currentLocation = useLocation();
  const isLandingPage = currentLocation.pathname === '/';
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close the menu whenever the page (or the #section on the landing page) changes.
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [currentLocation.pathname, currentLocation.hash]);

  // Escape closes the menu, as keyboard users expect.
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const handleEscapeKeyPress = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === 'Escape') setIsMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleEscapeKeyPress);
    return () => window.removeEventListener('keydown', handleEscapeKeyPress);
  }, [isMobileMenuOpen]);

  // Tapping any link or button inside the menu (including #section anchors and Sign out) closes it.
  const handleMenuItemClick = (clickEvent: MouseEvent<HTMLDivElement>) => {
    if ((clickEvent.target as HTMLElement).closest('a, button')) setIsMobileMenuOpen(false);
  };

  const handleSignOutClick = () => {
    signOut();
    navigateToPage('/');
  };

  return (
    <header className={`navigation-bar${isLandingPage ? ' navigation-bar--landing' : ''}${isMobileMenuOpen ? ' navigation-bar--menu-open' : ''}`}>
      <div className="navigation-bar__inner">
        <Link to="/" className="navigation-bar__brand">
          <span className="navigation-bar__brand-mark">🎓</span> Selah Tech Academy
        </Link>

        <button
          type="button"
          className="navigation-bar__menu-toggle"
          aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMobileMenuOpen}
          aria-controls="main-navigation-menu"
          onClick={() => setIsMobileMenuOpen((wasOpen) => !wasOpen)}
        >
          <span className="navigation-bar__menu-toggle-bar" />
          <span className="navigation-bar__menu-toggle-bar" />
          <span className="navigation-bar__menu-toggle-bar" />
        </button>

        <div id="main-navigation-menu" className="navigation-bar__menu" onClick={handleMenuItemClick}>
        <nav className="navigation-bar__links">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/courses">All Courses</NavLink>
          {isLandingPage && (
            <>
              <a href="#about">About</a>
              <a href="#contact">Contact</a>
            </>
          )}
          {currentUser?.userRole === 'STUDENT' && (
            <>
              <NavLink to="/my-learning">My Learning</NavLink>
              <NavLink to="/my-certificates">Certificates</NavLink>
            </>
          )}
          {(currentUser?.userRole === 'INSTRUCTOR' || currentUser?.userRole === 'ADMIN') && (
            <NavLink to="/instructor">Instructor Studio</NavLink>
          )}
          {currentUser?.userRole === 'ADMIN' && <NavLink to="/admin">Admin</NavLink>}
        </nav>

        <div className="navigation-bar__account">
          {currentUser ? (
            <>
              <span className="navigation-bar__user-name">{currentUser.fullName}</span>
              <span className="badge badge--neutral">{currentUser.userRole}</span>
              <button type="button" className="button button--secondary button--small" onClick={handleSignOutClick}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="button button--secondary button--small">
                Sign in
              </Link>
              <Link to="/register" className="button button--primary button--small">
                Sign up
              </Link>
            </>
          )}
        </div>
        </div>
      </div>
    </header>
  );
}
