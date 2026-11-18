import { Link, Route, Routes } from 'react-router-dom';
import { NavigationBar } from './components/NavigationBar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { CertificatesPage } from './pages/CertificatesPage';
import { CourseCatalogPage } from './pages/CourseCatalogPage';
import { CourseDetailPage } from './pages/CourseDetailPage';
import { InstructorCloudinarySettingsPage } from './pages/InstructorCloudinarySettingsPage';
import { InstructorCourseEditorPage } from './pages/InstructorCourseEditorPage';
import { InstructorDashboardPage } from './pages/InstructorDashboardPage';
import { LandingPage } from './pages/LandingPage';
import { LessonPlayerPage } from './pages/LessonPlayerPage';
import { LoginPage } from './pages/LoginPage';
import { PaymentCallbackPage } from './pages/PaymentCallbackPage';
import { RegisterPage } from './pages/RegisterPage';
import { ScholarshipApplicationPage } from './pages/ScholarshipApplicationPage';
import { StudentDashboardPage } from './pages/StudentDashboardPage';

function PageNotFound() {
  return (
    <div className="page-container narrow-page">
      <div className="card centered-card">
        <h1>Page not found</h1>
        <Link to="/" className="button button--primary">
          Back to home
        </Link>
      </div>
    </div>
  );
}

export function App() {
  return (
    <>
      <NavigationBar />
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/courses" element={<CourseCatalogPage />} />
        <Route path="/scholarship" element={<ScholarshipApplicationPage />} />
        <Route path="/courses/:courseId" element={<CourseDetailPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Student journey: pay -> learn -> certificate */}
        <Route path="/payment/callback" element={<ProtectedRoute><PaymentCallbackPage /></ProtectedRoute>} />
        <Route path="/my-learning" element={<ProtectedRoute allowedUserRoles={['STUDENT']}><StudentDashboardPage /></ProtectedRoute>} />
        <Route path="/my-certificates" element={<ProtectedRoute allowedUserRoles={['STUDENT']}><CertificatesPage /></ProtectedRoute>} />
        <Route path="/learn/:courseId" element={<ProtectedRoute><LessonPlayerPage /></ProtectedRoute>} />
        <Route path="/learn/:courseId/lessons/:lessonId" element={<ProtectedRoute><LessonPlayerPage /></ProtectedRoute>} />

        {/* Instructor studio */}
        <Route path="/instructor" element={<ProtectedRoute allowedUserRoles={['INSTRUCTOR', 'ADMIN']}><InstructorDashboardPage /></ProtectedRoute>} />
        <Route path="/instructor/cloudinary" element={<ProtectedRoute allowedUserRoles={['INSTRUCTOR']}><InstructorCloudinarySettingsPage /></ProtectedRoute>} />
        <Route path="/instructor/courses/:courseId" element={<ProtectedRoute allowedUserRoles={['INSTRUCTOR', 'ADMIN']}><InstructorCourseEditorPage /></ProtectedRoute>} />

        {/* Administration */}
        <Route path="/admin" element={<ProtectedRoute allowedUserRoles={['ADMIN']}><AdminDashboardPage /></ProtectedRoute>} />

        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </>
  );
}
