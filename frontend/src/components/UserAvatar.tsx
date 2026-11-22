import type { PublicUser } from '../types/applicationTypes';

function buildInitials(fullName: string): string {
  const nameParts = fullName.trim().split(/\s+/).filter(Boolean);
  return ((nameParts[0]?.[0] ?? '') + (nameParts.length > 1 ? nameParts[nameParts.length - 1][0] : '')).toUpperCase();
}

/** The profile picture, or the user's initials when no picture was uploaded. */
export function UserAvatar({ user, avatarSize = 'small' }: { user: Pick<PublicUser, 'fullName' | 'profilePictureDataUrl'>; avatarSize?: 'small' | 'large' }) {
  return (
    <span className={`user-avatar user-avatar--${avatarSize}`}>
      {user.profilePictureDataUrl ? <img src={user.profilePictureDataUrl} alt={`${user.fullName}'s profile picture`} /> : <span aria-hidden="true">{buildInitials(user.fullName)}</span>}
    </span>
  );
}
