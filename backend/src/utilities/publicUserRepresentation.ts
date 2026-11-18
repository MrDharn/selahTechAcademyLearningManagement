import type { User } from '@prisma/client';

/** Never send hashedPassword to the browser. */
export function toPublicUserRepresentation(user: User) {
  return {
    userId: user.id,
    fullName: user.fullName,
    emailAddress: user.emailAddress,
    userRole: user.userRole,
    isAccountActive: user.isAccountActive,
    createdAt: user.createdAt,
  };
}
