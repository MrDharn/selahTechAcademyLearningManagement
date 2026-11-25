import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CourseThumbnail } from '../components/CourseThumbnail';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { StarRatingDisplay } from '../components/StarRating';
import { StatusMessage } from '../components/StatusMessage';
import { extractErrorMessage, sendApiRequest } from '../services/applicationProgrammingInterfaceClient';
import type { CourseSortKey, CourseSummary } from '../types/applicationTypes';
import { formatKoboAsNaira } from '../utilities/formattingUtilities';

const SEARCH_TYPING_PAUSE_IN_MILLISECONDS = 350;

const SORT_OPTION_LABELS: Record<CourseSortKey, string> = {
  newest: 'Newest',
  most_popular: 'Most popular',
  top_rated: 'Top rated',
  price_low_to_high: 'Price: low to high',
  price_high_to_low: 'Price: high to low',
};

export function CourseCatalogPage() {
  const [availableCourses, setAvailableCourses] = useState<CourseSummary[] | null>(null);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [searchTextDraft, setSearchTextDraft] = useState('');
  const [appliedSearchText, setAppliedSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSortKey, setSelectedSortKey] = useState<CourseSortKey>('newest');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Wait until the visitor pauses typing before asking the server.
  useEffect(() => {
    const typingPauseTimer = window.setTimeout(() => setAppliedSearchText(searchTextDraft.trim()), SEARCH_TYPING_PAUSE_IN_MILLISECONDS);
    return () => window.clearTimeout(typingPauseTimer);
  }, [searchTextDraft]);

  useEffect(() => {
    let isLatestRequest = true;
    const queryParameters = new URLSearchParams();
    if (appliedSearchText) queryParameters.set('search', appliedSearchText);
    if (selectedCategory) queryParameters.set('category', selectedCategory);
    queryParameters.set('sort', selectedSortKey);

    setIsRefreshing(true);
    sendApiRequest<{ courses: CourseSummary[]; availableCategories: string[] }>(`/courses?${queryParameters.toString()}`)
      .then((catalogResponse) => {
        if (!isLatestRequest) return;
        setAvailableCourses(catalogResponse.courses);
        // Keep the category list stable while a category filter is active.
        if (!selectedCategory) setAvailableCategories(catalogResponse.availableCategories);
        setErrorMessage(null);
      })
      .catch((loadError) => isLatestRequest && setErrorMessage(extractErrorMessage(loadError)))
      .finally(() => isLatestRequest && setIsRefreshing(false));

    return () => {
      isLatestRequest = false;
    };
  }, [appliedSearchText, selectedCategory, selectedSortKey]);

  const isFilterActive = Boolean(appliedSearchText || selectedCategory);

  return (
    <div className="page-container">
      <h1>All courses</h1>
      <p className="muted-text">Practical, instructor-led courses with video lessons, quizzes and certificates.</p>

      <div className="catalog-filters">
        <input
          type="search"
          className="catalog-filters__search"
          placeholder="Search by title, topic or instructor"
          value={searchTextDraft}
          onChange={(changeEvent) => setSearchTextDraft(changeEvent.target.value)}
          aria-label="Search courses"
        />
        <select value={selectedCategory} onChange={(changeEvent) => setSelectedCategory(changeEvent.target.value)} aria-label="Filter by category">
          <option value="">All categories</option>
          {availableCategories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        <select value={selectedSortKey} onChange={(changeEvent) => setSelectedSortKey(changeEvent.target.value as CourseSortKey)} aria-label="Sort courses">
          {(Object.keys(SORT_OPTION_LABELS) as CourseSortKey[]).map((sortKey) => (
            <option key={sortKey} value={sortKey}>
              {SORT_OPTION_LABELS[sortKey]}
            </option>
          ))}
        </select>
        {isRefreshing && availableCourses && <LoadingIndicator layoutVariant="inline" />}
      </div>

      <StatusMessage messageKind="error" messageText={errorMessage} />
      {!availableCourses && !errorMessage && <LoadingIndicator layoutVariant="section" />}
      {availableCourses?.length === 0 && (
        <p className="muted-text">{isFilterActive ? 'No courses match your search. Try a different word or category.' : 'No courses have been published yet. Check back soon.'}</p>
      )}

      <div className="course-grid">
        {availableCourses?.map((course) => (
          <Link key={course.courseId} to={`/courses/${course.courseId}`} className="card course-card">
            <CourseThumbnail courseTitle={course.title} thumbnailImageUrl={course.thumbnailImageUrl} />
            <div className="course-card__body">
              <span className="category-badge">{course.category}</span>
              <h3>{course.title}</h3>
              <p className="muted-text course-card__description">{course.description}</p>
              <StarRatingDisplay averageRating={course.averageRating} reviewCount={course.reviewCount} />
              <p className="muted-text">
                by {course.instructorFullName} · {course.lessonCount} lessons
              </p>
              <p className="course-card__price">{formatKoboAsNaira(course.priceInKobo)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
