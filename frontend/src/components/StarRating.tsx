interface StarRatingDisplayProps {
  averageRating: number | null;
  reviewCount: number;
  /** Single reviews show only the stars, not "(1)". */
  shouldHideCount?: boolean;
}

/** Read-only stars with the average and the number of reviews, e.g. ★★★★☆ 4.3 (12). */
export function StarRatingDisplay({ averageRating, reviewCount, shouldHideCount = false }: StarRatingDisplayProps) {
  if (averageRating === null) return <span className="muted-text star-rating-display">No reviews yet</span>;
  const filledStarCount = Math.round(averageRating);
  return (
    <span className="star-rating-display" aria-label={`Rated ${averageRating} out of 5 from ${reviewCount} reviews`}>
      <span className="star-rating-display__stars" aria-hidden="true">
        {'★'.repeat(filledStarCount)}
        <span className="star-rating-display__empty">{'★'.repeat(5 - filledStarCount)}</span>
      </span>{' '}
      <strong>{averageRating.toFixed(1)}</strong>
      {!shouldHideCount && <span className="muted-text"> ({reviewCount})</span>}
    </span>
  );
}

interface StarRatingInputProps {
  selectedRating: number;
  onRatingSelected: (newRating: number) => void;
}

export function StarRatingInput({ selectedRating, onRatingSelected }: StarRatingInputProps) {
  return (
    <div className="star-rating-input" role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((starValue) => (
        <button
          key={starValue}
          type="button"
          role="radio"
          aria-checked={selectedRating === starValue}
          aria-label={`${starValue} out of 5`}
          className={starValue <= selectedRating ? 'star-rating-input__star star-rating-input__star--filled' : 'star-rating-input__star'}
          onClick={() => onRatingSelected(starValue)}
        >
          ★
        </button>
      ))}
    </div>
  );
}
