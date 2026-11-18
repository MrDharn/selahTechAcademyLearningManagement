import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { CourseThumbnail } from '../components/CourseThumbnail';
import { StatusMessage } from '../components/StatusMessage';
import { extractErrorMessage, sendApiRequest } from '../services/applicationProgrammingInterfaceClient';
import type { CourseSummary } from '../types/applicationTypes';
import { formatKoboAsNaira } from '../utilities/formattingUtilities';

export function CourseCatalogPage() {
  const [availableCourses, setAvailableCourses] = useState<CourseSummary[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    sendApiRequest<{ courses: CourseSummary[] }>('/courses')
      .then((catalogResponse) => setAvailableCourses(catalogResponse.courses))
      .catch((loadError) => setErrorMessage(extractErrorMessage(loadError)));
  }, []);

  return (
    <div className="page-container">
      <h1>All courses</h1>
      <p className="muted-text">Practical, instructor-led courses with video lessons, quizzes and certificates.</p>
      <StatusMessage messageKind="error" messageText={errorMessage} />
      {!availableCourses && !errorMessage && <LoadingIndicator message="Loading courses..." />}
      {availableCourses?.length === 0 && <p className="muted-text">No courses have been published yet. Check back soon.</p>}

      <div className="course-grid">
        {availableCourses?.map((course) => (
          <Link key={course.courseId} to={`/courses/${course.courseId}`} className="card course-card">
            <CourseThumbnail courseTitle={course.title} thumbnailImageUrl={course.thumbnailImageUrl} />
            <div className="course-card__body">
              <h3>{course.title}</h3>
              <p className="muted-text course-card__description">{course.description}</p>
              <p className="muted-text">
                by {course.instructorFullName} · {course.lessonCount} lessons
              </p>
              <p className="course-card__price">{formatKoboAsNaira(course.priceInKobo)}</p>
              {course.isScholarshipAvailable && course.priceInKobo > 0 && (
                <p className="course-card__scholarship-note">Scholarship price: {formatKoboAsNaira(course.scholarshipPriceInKobo)}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
