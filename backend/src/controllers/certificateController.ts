import { environmentConfiguration } from '../configuration/environmentConfiguration';
import { prismaDatabaseClient } from '../database/prismaDatabaseClient';
import { issueCertificateIfStudentHasCompletedCourse, streamCertificatePdfToResponse } from '../services/certificateService';
import { ApplicationError } from '../utilities/ApplicationError';
import { asyncRequestHandler } from '../utilities/asyncRequestHandler';

export const listMyCertificates = asyncRequestHandler(async (request, response) => {
  const studentCertificates = await prismaDatabaseClient.certificate.findMany({
    where: { studentUserId: request.authenticatedUser!.userId },
    orderBy: { issuedAt: 'desc' },
    include: { course: { select: { title: true } } },
  });

  response.json({
    certificates: studentCertificates.map((certificate) => ({
      certificateId: certificate.id,
      courseId: certificate.courseId,
      courseTitle: certificate.course.title,
      certificateNumber: certificate.certificateNumber,
      issuedAt: certificate.issuedAt,
    })),
  });
});

/** Step 6: "Download Certificate". Works even after access has expired - the student earned it. */
export const downloadCertificatePdf = asyncRequestHandler(async (request, response) => {
  const authenticatedUser = request.authenticatedUser!;

  const issuedCertificate = await issueCertificateIfStudentHasCompletedCourse(authenticatedUser.userId, request.params.courseId);

  if (!issuedCertificate) {
    throw new ApplicationError(409, 'Complete every lesson in this course to earn your certificate.', 'COURSE_NOT_COMPLETED');
  }

  const [certificateOwner, certifiedCourse] = await Promise.all([
    prismaDatabaseClient.user.findUniqueOrThrow({ where: { id: authenticatedUser.userId } }),
    prismaDatabaseClient.course.findUniqueOrThrow({ where: { id: request.params.courseId } }),
  ]);

  streamCertificatePdfToResponse(
    {
      studentFullName: certificateOwner.fullName,
      courseTitle: certifiedCourse.title,
      certificateNumber: issuedCertificate.certificateNumber,
      issuedAt: issuedCertificate.issuedAt,
      verificationPageUrl: `${environmentConfiguration.frontendBaseUrl}/verify/${issuedCertificate.certificateNumber}`,
    },
    response,
  );
});

/**
 * Public (no sign-in): lets an employer confirm a certificate is real. It shares only what is printed on the
 * certificate (name, course, date), never an e-mail address or any account detail.
 */
export const verifyCertificateByNumber = asyncRequestHandler(async (request, response) => {
  const certificateNumber = request.params.certificateNumber.trim().toUpperCase();

  const matchingCertificate = await prismaDatabaseClient.certificate.findUnique({
    where: { certificateNumber },
    include: { studentUser: { select: { fullName: true } }, course: { select: { title: true } } },
  });

  if (!matchingCertificate) {
    response.status(404).json({ isCertificateValid: false, errorMessage: 'No certificate with this number was found.', errorCode: 'CERTIFICATE_NOT_FOUND' });
    return;
  }

  response.json({
    isCertificateValid: true,
    certificateNumber: matchingCertificate.certificateNumber,
    holderFullName: matchingCertificate.studentUser.fullName,
    courseTitle: matchingCertificate.course.title,
    issuedAt: matchingCertificate.issuedAt,
    issuedBy: 'Selah Tech Academy',
  });
});
