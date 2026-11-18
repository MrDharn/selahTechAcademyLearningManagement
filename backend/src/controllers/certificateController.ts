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
    },
    response,
  );
});
