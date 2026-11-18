interface CourseThumbnailProps {
  courseTitle: string;
  thumbnailImageUrl: string | null;
  sizeVariant?: 'card' | 'banner';
}

/** Gives each course without an uploaded cover its own colour (derived from the title) so no two look identical. */
function buildPlaceholderBackground(courseTitle: string): string {
  let titleHashValue = 0;
  for (const titleCharacter of courseTitle) titleHashValue = (titleHashValue * 31 + titleCharacter.charCodeAt(0)) % 360;
  const secondaryHue = (titleHashValue + 40) % 360;
  return `linear-gradient(135deg, hsl(${titleHashValue} 62% 36%), hsl(${secondaryHue} 70% 50%))`;
}

function extractInitials(courseTitle: string): string {
  return courseTitle
    .split(' ')
    .filter((titleWord) => /[A-Za-z0-9]/.test(titleWord))
    .slice(0, 2)
    .map((titleWord) => titleWord[0].toUpperCase())
    .join('');
}

export function CourseThumbnail({ courseTitle, thumbnailImageUrl, sizeVariant = 'card' }: CourseThumbnailProps) {
  const containerClassName = `course-thumbnail course-thumbnail--${sizeVariant}`;

  if (thumbnailImageUrl) {
    return (
      <div className={containerClassName}>
        <img src={thumbnailImageUrl} alt={`${courseTitle} cover`} loading="lazy" />
      </div>
    );
  }

  return (
    <div className={containerClassName} style={{ background: buildPlaceholderBackground(courseTitle) }} aria-hidden="true">
      <span className="course-thumbnail__initials">{extractInitials(courseTitle)}</span>
    </div>
  );
}
