import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuthentication } from '../context/AuthenticationContext';

export function NavigationBar() {
  const { currentUser, signOut } = useAuthentication();
  const navigateToPage = useNavigate();
  const isLandingPage = useLocation().pathname === '/';

  const handleSignOutClick = () => {
    signOut();
    navigateToPage('/');
  };

  return (
    <header className={`navigation-bar${isLandingPage ? ' navigation-bar--landing' : ''}`}>
      <div className="navigation-bar__inner">
        <Link to="/" className="navigation-bar__brand">
          <span className="navigation-bar__brand-mark">🎓</span> Selah Tech Academy
        </Link>

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
          {(!currentUser || currentUser.userRole === 'STUDENT') && <NavLink to="/scholarship">Scholarship</NavLink>}
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
    </header>
  );
}
