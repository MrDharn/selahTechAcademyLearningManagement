export type UserRole = 'STUDENT' | 'INSTRUCTOR' | 'ADMIN';
export type CourseAccessStatus = 'ACTIVE' | 'GRACE_PERIOD' | 'EXPIRED' | 'NOT_ENROLLED' | 'PRIVILEGED_VIEWER';
export type PaymentStatus = 'PENDING' | 'SUCCESSFUL' | 'FAILED';
export type EnrollmentType = 'STANDARD' | 'SCHOLARSHIP';
export type ScholarshipApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface PublicUser {
  userId: string;
  fullName: string;
  emailAddress: string;
  userRole: UserRole;
  isAccountActive: boolean;
  createdAt: string;
  phoneNumber: string | null;
  profilePictureDataUrl: string | null;
}

export interface AuthenticationResponse {
  authenticationToken: string;
  user: PublicUser;
  isNewAccount?: boolean;
}

export interface GoogleSignInConfiguration {
  isGoogleSignInEnabled: boolean;
  googleClientId: string | null;
}

export interface CourseSummary {
  courseId: string;
  title: string;
  description: string;
  priceInKobo: number;
  category: string;
  thumbnailImageUrl: string | null;
  instructorFullName: string;
  moduleCount: number;
  lessonCount: number;
  averageRating: number | null;
  reviewCount: number;
}

export type CourseSortKey = 'newest' | 'price_low_to_high' | 'price_high_to_low' | 'top_rated' | 'most_popular';

export interface CourseReview {
  reviewId: string;
  reviewerDisplayName: string;
  ratingOutOfFive: number;
  reviewText: string | null;
  createdAt: string;
  isMyReview: boolean;
}

export interface CourseReviewsResponse {
  averageRating: number | null;
  reviewCount: number;
  ratingDistribution: number[];
  reviews: CourseReview[];
}

export interface CourseOutlineLesson {
  lessonId: string;
  title: string;
  description: string | null;
  videoDurationInSeconds: number | null;
}

export interface CourseOutlineModule {
  courseModuleId: string;
  title: string;
  lessons: CourseOutlineLesson[];
}

export interface CourseDetails {
  courseId: string;
  title: string;
  description: string;
  priceInKobo: number;
  thumbnailImageUrl: string | null;
  category: string;
  averageRating: number | null;
  reviewCount: number;
  instructorFullName: string;
  modules: CourseOutlineModule[];
}

export interface ScholarshipCourseOffer {
  courseId: string;
  title: string;
  description: string;
  fullPriceInKobo: number;
  scholarshipPriceInKobo: number;
  totalModuleCount: number;
  includedModuleTitles: string[];
}

export interface ScholarshipProgramResponse {
  /** False while an admin has closed the program; then `courses` is empty. */
  isProgramOpen: boolean;
  scholarshipDiscountPercentage: number;
  courses: ScholarshipCourseOffer[];
}

export interface MyScholarshipApplication {
  scholarshipApplicationId: string;
  courseId: string;
  courseTitle: string;
  scholarshipPriceInKobo: number;
  applicationStatus: ScholarshipApplicationStatus;
  reviewerNote: string | null;
  submittedAt: string;
}

export interface AdminScholarshipApplication {
  scholarshipApplicationId: string;
  applicantFullName: string;
  applicantEmailAddress: string;
  phoneNumber: string;
  currentOccupation: string;
  motivationStatement: string;
  courseTitle: string;
  applicationStatus: ScholarshipApplicationStatus;
  reviewerNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
}

export interface PaymentInitializationResponse {
  isFreeCourseEnrollmentComplete: boolean;
  paystackReference: string;
  paystackAuthorizationUrl?: string;
}

export interface PaymentFulfillmentResult {
  paymentStatus: PaymentStatus;
  courseId: string;
  accessExpiresAt: string | null;
  gracePeriodEndsAt: string | null;
}

export interface EnrollmentSummary {
  enrollmentId: string;
  courseId: string;
  courseTitle: string;
  courseDescription: string;
  thumbnailImageUrl: string | null;
  enrollmentType: EnrollmentType;
  accessStatus: 'ACTIVE' | 'GRACE_PERIOD' | 'EXPIRED';
  accessExpiresAt: string;
  gracePeriodEndsAt: string;
  completionPercentage: number;
  completedLessonCount: number;
  totalLessonCount: number;
  nextLessonIdToWatch: string | null;
}

export interface StudentLessonProgress {
  lessonId: string;
  lessonTitle: string;
  courseModuleId: string;
  courseModuleTitle: string;
  positionInCourse: number;
  hasAssessment: boolean;
  videoDurationInSeconds: number | null;
  hasUploadedVideo: boolean;
  isCompleted: boolean;
  isUnlocked: boolean;
  lastWatchedPositionInSeconds: number;
}

export interface CourseProgressResponse {
  courseTitle: string;
  courseAccessStatus: CourseAccessStatus;
  accessExpiresAt: string | null;
  gracePeriodEndsAt: string | null;
  progress: {
    courseId: string;
    lessons: StudentLessonProgress[];
    completedLessonCount: number;
    totalLessonCount: number;
    completionPercentage: number;
    isCourseFullyCompleted: boolean;
  };
}

export interface LessonStreamResponse {
  lessonId: string;
  lessonTitle: string;
  lessonDescription: string | null;
  hlsStreamingUrl: string;
  lastWatchedPositionInSeconds: number;
  isLessonCompleted: boolean;
  courseAccessStatus: CourseAccessStatus;
  accessExpiresAt: string | null;
  gracePeriodEndsAt: string | null;
}

export interface StudentAssessmentQuestion {
  assessmentQuestionId: string;
  questionText: string;
  answerOptions: { answerOptionId: string; optionText: string }[];
}

export interface StudentAssessmentResponse {
  assessment: {
    assessmentId: string;
    title: string;
    passMarkPercentage: number;
    questions: StudentAssessmentQuestion[];
  };
  previousAttempts: { scorePercentage: number; hasPassed: boolean; submittedAt: string }[];
}

export interface AssessmentSubmissionResult {
  scorePercentage: number;
  hasPassed: boolean;
  passMarkPercentage: number;
  correctAnswerCount: number;
  totalQuestionCount: number;
  completionPercentage: number;
  isCertificateIssued: boolean;
}

export interface CertificateSummary {
  certificateId: string;
  courseId: string;
  courseTitle: string;
  certificateNumber: string;
  issuedAt: string;
}

export interface ManagedCourseSummary {
  courseId: string;
  title: string;
  priceInKobo: number;
  isPublished: boolean;
  thumbnailImageUrl: string | null;
  instructorFullName: string;
  moduleCount: number;
  enrolledStudentCount: number;
}

export interface EditableLesson {
  id: string;
  title: string;
  description: string | null;
  sequenceOrderNumber: number;
  cloudinaryVideoPublicId: string | null;
  videoDurationInSeconds: number | null;
  assessment: { id: string; title: string; passMarkPercentage: number } | null;
}

export interface EditableCourseModule {
  id: string;
  title: string;
  isIncludedInScholarship: boolean;
  sequenceOrderNumber: number;
  lessons: EditableLesson[];
}

export interface EditableCourse {
  id: string;
  title: string;
  description: string;
  priceInKobo: number;
  thumbnailImageUrl: string | null;
  category: string;
  isPublished: boolean;
  isScholarshipAvailable: boolean;
  courseModules: EditableCourseModule[];
}

export interface CloudinaryAccountSummary {
  isCloudinaryAccountConnected: boolean;
  cloudinaryCloudName: string | null;
  cloudinaryApiKey: string | null;
}

export interface SignedImageUploadParameters {
  uploadUrl: string;
  cloudinaryApiKey: string;
  uploadSignature: string;
  signedFormFields: Record<string, string | number>;
}

export interface SignedVideoUploadParameters {
  uploadUrl: string;
  cloudinaryApiKey: string;
  uploadSignature: string;
  signedFormFields: Record<string, string | number>;
}

export interface InstructorAssessmentDefinition {
  id: string;
  title: string;
  passMarkPercentage: number;
  questions: {
    id: string;
    questionText: string;
    answerOptions: { id: string; optionText: string; isCorrectOption: boolean }[];
  }[];
}

export interface PlatformStatistics {
  studentCount: number;
  instructorCount: number;
  administratorCount: number;
  courseCount: number;
  publishedCourseCount: number;
  enrollmentCount: number;
  totalRevenueInKobo: number;
}

export interface AdminPaymentRecord {
  paymentId: string;
  studentFullName: string;
  studentEmailAddress: string;
  courseTitle: string;
  paystackReference: string;
  amountInKobo: number;
  isScholarshipPayment: boolean;
  paymentStatus: PaymentStatus;
  paidAt: string | null;
  createdAt: string;
}

export interface EnrolledCourseSummary {
  courseId: string;
  courseTitle: string;
  thumbnailImageUrl: string | null;
  enrollmentType: 'STANDARD' | 'SCHOLARSHIP';
  enrolledAt: string;
  accessExpiresAt: string;
  gracePeriodEndsAt: string;
  courseAccessStatus: 'ACTIVE' | 'GRACE_PERIOD' | 'EXPIRED';
}

export interface MyAccountResponse {
  user: PublicUser;
  hasPassword: boolean;
  enrolledCourses: EnrolledCourseSummary[];
}

/** What a student would pay right now: first purchase, renewal (by progress) or retake (100% covered). */
export interface CoursePurchaseQuote {
  purchaseKind: 'ENROLLMENT' | 'RENEWAL' | 'RETAKE';
  amountInKobo: number;
  basePriceInKobo: number;
  fullCoursePriceInKobo: number;
  completionPercentage: number | null;
}
