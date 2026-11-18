/**
 * ACTIVE            - inside the paid window (default 3 months)
 * GRACE_PERIOD      - paid window ended, grace window still open (default +1 month)
 * EXPIRED           - both windows ended; renewal payment required
 * NOT_ENROLLED      - never paid for this course
 * PRIVILEGED_VIEWER - the course's own instructor, or an administrator
 */
export type CourseAccessStatus = 'ACTIVE' | 'GRACE_PERIOD' | 'EXPIRED' | 'NOT_ENROLLED' | 'PRIVILEGED_VIEWER';
