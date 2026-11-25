/** Pure rating helpers (no database), so they can be tested on their own. */
export interface RatingSummary {
  /** Average rating rounded to one decimal, or null when nobody has rated yet. */
  averageRating: number | null;
  reviewCount: number;
  /** How many reviews gave 1, 2, 3, 4 and 5 stars (index 0 = 1 star). */
  ratingDistribution: [number, number, number, number, number];
}

export function summarizeRatings(ratingsOutOfFive: number[]): RatingSummary {
  const ratingDistribution: RatingSummary['ratingDistribution'] = [0, 0, 0, 0, 0];
  for (const rating of ratingsOutOfFive) {
    if (Number.isInteger(rating) && rating >= 1 && rating <= 5) ratingDistribution[rating - 1] += 1;
  }
  const reviewCount = ratingDistribution.reduce((runningTotal, count) => runningTotal + count, 0);
  if (reviewCount === 0) return { averageRating: null, reviewCount: 0, ratingDistribution };

  const totalStars = ratingDistribution.reduce((runningTotal, count, index) => runningTotal + count * (index + 1), 0);
  return { averageRating: Math.round((totalStars / reviewCount) * 10) / 10, reviewCount, ratingDistribution };
}

/** Public reviews show "Helen A." instead of the full name. */
export function formatReviewerDisplayName(fullName: string): string {
  const nameParts = fullName.trim().split(/\s+/).filter(Boolean);
  if (nameParts.length === 0) return 'Student';
  if (nameParts.length === 1) return nameParts[0];
  return `${nameParts[0]} ${nameParts[nameParts.length - 1][0].toUpperCase()}.`;
}

export type CourseSortKey = 'newest' | 'price_low_to_high' | 'price_high_to_low' | 'top_rated' | 'most_popular';

export function compareCoursesForSort<CourseForSort extends { createdAt: Date; priceInKobo: number; averageRating: number | null; reviewCount: number; enrolledStudentCount: number }>(
  sortKey: CourseSortKey,
): (firstCourse: CourseForSort, secondCourse: CourseForSort) => number {
  const newestFirst = (firstCourse: CourseForSort, secondCourse: CourseForSort) => secondCourse.createdAt.getTime() - firstCourse.createdAt.getTime();

  switch (sortKey) {
    case 'price_low_to_high':
      return (firstCourse, secondCourse) => firstCourse.priceInKobo - secondCourse.priceInKobo || newestFirst(firstCourse, secondCourse);
    case 'price_high_to_low':
      return (firstCourse, secondCourse) => secondCourse.priceInKobo - firstCourse.priceInKobo || newestFirst(firstCourse, secondCourse);
    case 'top_rated':
      // Unrated courses go last; ties are broken by how many people rated.
      return (firstCourse, secondCourse) =>
        (secondCourse.averageRating ?? -1) - (firstCourse.averageRating ?? -1) || secondCourse.reviewCount - firstCourse.reviewCount || newestFirst(firstCourse, secondCourse);
    case 'most_popular':
      return (firstCourse, secondCourse) => secondCourse.enrolledStudentCount - firstCourse.enrolledStudentCount || newestFirst(firstCourse, secondCourse);
    default:
      return newestFirst;
  }
}
