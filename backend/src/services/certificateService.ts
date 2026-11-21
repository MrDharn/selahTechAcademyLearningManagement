import { randomBytes } from 'crypto';
import type { Response } from 'express';
import PDFDocument from 'pdfkit';
import { prismaDatabaseClient } from '../database/prismaDatabaseClient';
import { buildStudentCourseProgress } from './courseProgressService';
import { drawCertificateOfCompletion, type CertificateDetails } from './certificatePdfRenderer';

function generateCertificateNumber(): string {
  const currentYear = new Date().getFullYear();
  const randomSuffix = randomBytes(4).toString('hex').toUpperCase();
  return `STA-${currentYear}-${randomSuffix}`;
}

/** Issues the certificate once every lesson in the course is completed. Safe to call repeatedly. */
export async function issueCertificateIfStudentHasCompletedCourse(studentUserId: string, courseId: string) {
  const existingCertificate = await prismaDatabaseClient.certificate.findUnique({
    where: { studentUserId_courseId: { studentUserId, courseId } },
  });
  if (existingCertificate) return existingCertificate;

  const studentCourseProgress = await buildStudentCourseProgress(studentUserId, courseId);
  if (!studentCourseProgress.isCourseFullyCompleted) return null;

  return prismaDatabaseClient.certificate.create({
    data: { studentUserId, courseId, certificateNumber: generateCertificateNumber() },
  });
}

export function streamCertificatePdfToResponse(
  certificateDetails: CertificateDetails,
  httpResponse: Response,
) {
  const certificateDocument = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });

  httpResponse.setHeader('Content-Type', 'application/pdf');
  httpResponse.setHeader('Content-Disposition', `attachment; filename="${certificateDetails.certificateNumber}.pdf"`);
  certificateDocument.pipe(httpResponse);

  drawCertificateOfCompletion(certificateDocument, certificateDetails);

  certificateDocument.end();
}
