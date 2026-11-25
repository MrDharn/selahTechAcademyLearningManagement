import { useCallback, useEffect, useState } from 'react';
import { LoadingButtonContent } from './LoadingButtonContent';
import { LoadingIndicator } from './LoadingIndicator';
import { StarRatingDisplay, StarRatingInput } from './StarRating';
import { StatusMessage } from './StatusMessage';
import { extractErrorMessage, sendApiRequest } from '../services/applicationProgrammingInterfaceClient';
import type { CourseReviewsResponse } from '../types/applicationTypes';
import { formatCalendarDate } from '../utilities/formattingUtilities';

interface CourseReviewsSectionProps {
  courseId: string;
  /** Only students who are enrolled can write a review. */
  canWriteReview: boolean;
  onReviewsChanged: () => void;
}

export function CourseReviewsSection({ courseId, canWriteReview, onReviewsChanged }: CourseReviewsSectionProps) {
  const [reviewsResponse, setReviewsResponse] = useState<CourseReviewsResponse | null>(null);
  const [ratingDraft, setRatingDraft] = useState(0);
  const [reviewTextDraft, setReviewTextDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadReviews = useCallback(async () => {
    try {
      const loaded = await sendApiRequest<CourseReviewsResponse>(`/courses/${courseId}/reviews`);
      setReviewsResponse(loaded);
      const myExistingReview = loaded.reviews.find((review) => review.isMyReview);
      if (myExistingReview) {
        setRatingDraft(myExistingReview.ratingOutOfFive);
        setReviewTextDraft(myExistingReview.reviewText ?? '');
      }
    } catch (loadError) {
      setErrorMessage(extractErrorMessage(loadError));
    }
  }, [courseId]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const hasMyReview = Boolean(reviewsResponse?.reviews.some((review) => review.isMyReview));

  const handleSubmit = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    if (ratingDraft < 1) {
      setErrorMessage('Please choose a star rating first.');
      return;
    }
    setErrorMessage(null);
    setIsSaving(true);
    try {
      await sendApiRequest(`/courses/${courseId}/reviews`, { httpMethod: 'POST', jsonBody: { ratingOutOfFive: ratingDraft, reviewText: reviewTextDraft } });
      setSuccessMessage('Thank you! Your review has been saved.');
      await loadReviews();
      onReviewsChanged();
    } catch (saveError) {
      setErrorMessage(extractErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMyReview = async () => {
    if (!window.confirm('Delete your review?')) return;
    try {
      await sendApiRequest(`/courses/${courseId}/reviews/mine`, { httpMethod: 'DELETE' });
      setRatingDraft(0);
      setReviewTextDraft('');
      setSuccessMessage('Your review was deleted.');
      await loadReviews();
      onReviewsChanged();
    } catch (deleteError) {
      setErrorMessage(extractErrorMessage(deleteError));
    }
  };

  return (
    <section className="course-reviews">
      <h2>Student reviews</h2>
      {!reviewsResponse && !errorMessage && <LoadingIndicator layoutVariant="inline" />}
      <StatusMessage messageKind="error" messageText={errorMessage} />
      <StatusMessage messageKind="success" messageText={successMessage} />

      {reviewsResponse && (
        <>
          <div className="course-reviews__summary">
            <StarRatingDisplay averageRating={reviewsResponse.averageRating} reviewCount={reviewsResponse.reviewCount} />
            {reviewsResponse.reviewCount > 0 && (
              <div className="rating-distribution">
                {[5, 4, 3, 2, 1].map((starValue) => (
                  <div key={starValue} className="rating-distribution__row">
                    <span>{starValue}★</span>
                    <div className="rating-distribution__track">
                      <div className="rating-distribution__fill" style={{ width: `${(reviewsResponse.ratingDistribution[starValue - 1] / reviewsResponse.reviewCount) * 100}%` }} />
                    </div>
                    <span className="muted-text">{reviewsResponse.ratingDistribution[starValue - 1]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {canWriteReview && (
            <form className="card form-stack" onSubmit={handleSubmit}>
              <h3>{hasMyReview ? 'Edit your review' : 'Rate this course'}</h3>
              <StarRatingInput selectedRating={ratingDraft} onRatingSelected={setRatingDraft} />
              <label className="form-field">
                <span>Your thoughts (optional)</span>
                <textarea value={reviewTextDraft} onChange={(changeEvent) => setReviewTextDraft(changeEvent.target.value)} rows={3} maxLength={1000} />
              </label>
              <div className="button-row">
                <button type="submit" className="button button--primary" disabled={isSaving}>
                  <LoadingButtonContent isLoading={isSaving} loadingText="Saving...">
                    {hasMyReview ? 'Update review' : 'Submit review'}
                  </LoadingButtonContent>
                </button>
                {hasMyReview && (
                  <button type="button" className="button button--secondary" onClick={handleDeleteMyReview}>
                    Delete my review
                  </button>
                )}
              </div>
            </form>
          )}

          {reviewsResponse.reviews.length === 0 && <p className="muted-text">No reviews yet.</p>}
          {reviewsResponse.reviews.map((review) => (
            <article key={review.reviewId} className="card review-card">
              <div className="review-card__header">
                <strong>{review.reviewerDisplayName}</strong>
                <StarRatingDisplay averageRating={review.ratingOutOfFive} reviewCount={1} shouldHideCount />
                <span className="muted-text">{formatCalendarDate(review.createdAt)}</span>
              </div>
              {review.reviewText && <p>{review.reviewText}</p>}
            </article>
          ))}
        </>
      )}
    </section>
  );
}
