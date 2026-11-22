import type { User } from '@prisma/client';

/**
 * Never send hashedPassword to the browser.
 * Lists of many users (the admin user list) pass shouldIncludeProfilePicture = false to keep the response small.
 */
export function toPublicUserRepresentation(user: User, shouldIncludeProfilePicture = true) {
  return {
    userId: user.id,
    fullName: user.fullName,
    emailAddress: user.emailAddress,
    userRole: user.userRole,
    isAccountActive: user.isAccountActive,
    createdAt: user.createdAt,
    phoneNumber: user.phoneNumber,
    profilePictureDataUrl: shouldIncludeProfilePicture ? user.profilePictureDataUrl : null,
  };
}
