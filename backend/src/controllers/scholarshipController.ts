import { z } from 'zod';
import { prismaDatabaseClient } from '../database/prismaDatabaseClient';
import { isScholarshipProgramOpen } from '../services/scholarshipProgramStatusService';
import { calculateScholarshipPriceInKobo } from '../services/scholarshipPricingService';
import { environmentConfiguration } from '../configuration/environmentConfiguration';
import { ApplicationError } from '../utilities/ApplicationError';
import { asyncRequestHandler } from '../utilities/asyncRequestHandler';

const submitScholarshipApplicationRequestSchema = z.object({
  courseId: z.string().uuid(),
  phoneNumber: z.string().trim().min(7).max(25),
  currentOccupation: z.string().trim().min(2).max(120),
  motivationStatement: z.string().trim().min(30, 'Please tell us a little more (at least 30 characters).').max(2000),
});

/** Public: the scholarship program page lists every course that offers it, with the discounted price and included sections. */
export const listScholarshipCourses = asyncRequestHandler(async (_request, response) => {
  // While an admin has the program closed, nothing is offered: the landing page button and the program page hide themselves.
  if (!(await isScholarshipProgramOpen())) {
    response.json({ isProgramOpen: false, scholarshipDiscountPercentage: environmentConfiguration.scholarshipDiscountPercentage, courses: [] });
    return;
  }

  const scholarshipEligibleCourses = await prismaDatabaseClient.course.findMany({
    where: { isPublished: true, isScholarshipAvailable: true, courseModules: { some: { isIncludedInScholarship: true } } },
    orderBy: { title: 'asc' },
    include: { courseModules: { orderBy: { sequenceOrderNumber: 'asc' }, select: { title: true, isIncludedInScholarship: true } } },
  });

  response.json({
    isProgramOpen: true,
    scholarshipDiscountPercentage: environmentConfiguration.scholarshipDiscountPercentage,
    courses: scholarshipEligibleCourses.map((course) => ({
      courseId: course.id,
      title: course.title,
      description: course.description,
      fullPriceInKobo: course.priceInKobo,
      scholarshipPriceInKobo: calculateScholarshipPriceInKobo(course.priceInKobo),
      totalModuleCount: course.courseModules.length,
      includedModuleTitles: course.courseModules.filter((courseModule) => courseModule.isIncludedInScholarship).map((courseModule) => courseModule.title),
    })),
  });
});

export const submitScholarshipApplication = asyncRequestHandler(async (request, response) => {
  const applicantUserId = request.authenticatedUser!.userId;
  const applicationDetails = submitScholarshipApplicationRequestSchema.parse(request.body);

  // Closing the program stops NEW applications. Students who were already approved can still pay.
  if (!(await isScholarshipProgramOpen())) {
    throw new ApplicationError(403, 'The scholarship program is not accepting applications right now. Please check back later.', 'SCHOLARSHIP_PROGRAM_CLOSED');
  }

  const requestedCourse = await prismaDatabaseClient.course.findFirst({
    where: {
      id: applicationDetails.courseId,
      isPublished: true,
      isScholarshipAvailable: true,
      courseModules: { some: { isIncludedInScholarship: true } },
    },
  });
  if (!requestedCourse) {
    throw new ApplicationError(404, 'This course is not available in the scholarship program.', 'SCHOLARSHIP_COURSE_NOT_AVAILABLE');
  }

  const existingApplication = await prismaDatabaseClient.scholarshipApplication.findUnique({
    where: { applicantUserId_courseId: { applicantUserId, courseId: requestedCourse.id } },
  });

  if (existingApplication && existingApplication.applicationStatus !== 'REJECTED') {
    throw new ApplicationError(409, 'You have already applied for a scholarship on this course.', 'SCHOLARSHIP_ALREADY_APPLIED');
  }

  const applicationFields = {
    phoneNumber: applicationDetails.phoneNumber,
    currentOccupation: applicationDetails.currentOccupation,
    motivationStatement: applicationDetails.motivationStatement,
    applicationStatus: 'PENDING' as const,
    reviewerNote: null,
    reviewedByUserId: null,
    reviewedAt: null,
  };

  // A rejected student may re-apply: the same row goes back to PENDING with the new answers.
  const savedApplication = existingApplication
    ? await prismaDatabaseClient.scholarshipApplication.update({ where: { id: existingApplication.id }, data: applicationFields })
    : await prismaDatabaseClient.scholarshipApplication.create({
        data: { applicantUserId, courseId: requestedCourse.id, ...applicationFields },
      });

  response.status(201).json({ scholarshipApplicationId: savedApplication.id, applicationStatus: savedApplication.applicationStatus });
});

export const listMyScholarshipApplications = asyncRequestHandler(async (request, response) => {
  const myApplications = await prismaDatabaseClient.scholarshipApplication.findMany({
    where: { applicantUserId: request.authenticatedUser!.userId },
    orderBy: { createdAt: 'desc' },
    include: { course: { select: { id: true, title: true, priceInKobo: true } } },
  });

  response.json({
    applications: myApplications.map((application) => ({
      scholarshipApplicationId: application.id,
      courseId: application.course.id,
      courseTitle: application.course.title,
      scholarshipPriceInKobo: calculateScholarshipPriceInKobo(application.course.priceInKobo),
      applicationStatus: application.applicationStatus,
      reviewerNote: application.reviewerNote,
      submittedAt: application.createdAt,
    })),
  });
});
