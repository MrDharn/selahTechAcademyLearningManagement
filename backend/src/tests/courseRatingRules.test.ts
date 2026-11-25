import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compareCoursesForSort, formatReviewerDisplayName, summarizeRatings } from '../rules/courseRatingRules';

describe('summarizeRatings', () => {
  it('returns null average when there are no ratings', () => {
    assert.deepEqual(summarizeRatings([]), { averageRating: null, reviewCount: 0, ratingDistribution: [0, 0, 0, 0, 0] });
  });
  it('averages to one decimal and counts the distribution', () => {
    const summary = summarizeRatings([5, 4, 4]);
    assert.equal(summary.averageRating, 4.3);
    assert.equal(summary.reviewCount, 3);
    assert.deepEqual(summary.ratingDistribution, [0, 0, 0, 2, 1]);
  });
  it('ignores invalid values', () => {
    assert.equal(summarizeRatings([0, 6, 2.5, 3]).reviewCount, 1);
  });
});

describe('formatReviewerDisplayName', () => {
  it('shows first name and last initial', () => {
    assert.equal(formatReviewerDisplayName('Adekanye Oluwatosin Daniel'), 'Adekanye D.');
    assert.equal(formatReviewerDisplayName('  Helen '), 'Helen');
    assert.equal(formatReviewerDisplayName(''), 'Student');
  });
});

describe('compareCoursesForSort', () => {
  const makeCourse = (name: string, daysAgo: number, priceInKobo: number, averageRating: number | null, reviewCount: number, enrolledStudentCount: number) => ({
    name, priceInKobo, averageRating, reviewCount, enrolledStudentCount, createdAt: new Date(Date.UTC(2026, 10, 20 - daysAgo)),
  });
  const courses = [makeCourse('old', 10, 5000, 4.5, 2, 9), makeCourse('new', 1, 9000, null, 0, 1), makeCourse('mid', 5, 1000, 4.5, 8, 3)];
  const order = (key: Parameters<typeof compareCoursesForSort>[0]) => [...courses].sort(compareCoursesForSort(key)).map((course) => course.name);

  it('sorts by newest', () => assert.deepEqual(order('newest'), ['new', 'mid', 'old']));
  it('sorts by price', () => {
    assert.deepEqual(order('price_low_to_high'), ['mid', 'old', 'new']);
    assert.deepEqual(order('price_high_to_low'), ['new', 'old', 'mid']);
  });
  it('sorts top rated with ties by review count and unrated last', () => assert.deepEqual(order('top_rated'), ['mid', 'old', 'new']));
  it('sorts by popularity', () => assert.deepEqual(order('most_popular'), ['old', 'mid', 'new']));
});
