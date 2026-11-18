import { randomBytes } from 'crypto';
import type { Response } from 'express';
import PDFDocument from 'pdfkit';
import { prismaDatabaseClient } from '../database/prismaDatabaseClient';
import { buildStudentCourseProgress } from './courseProgressService';

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
  certificateDetails: { studentFullName: string; courseTitle: string; certificateNumber: string; issuedAt: Date },
  httpResponse: Response,
) {
  const certificateDocument = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 50 });

  httpResponse.setHeader('Content-Type', 'application/pdf');
  httpResponse.setHeader('Content-Disposition', `attachment; filename="${certificateDetails.certificateNumber}.pdf"`);
  certificateDocument.pipe(httpResponse);

  const pageWidth = certificateDocument.page.width;
  const pageHeight = certificateDocument.page.height;

  certificateDocument.lineWidth(6).strokeColor('#1e3a8a').rect(25, 25, pageWidth - 50, pageHeight - 50).stroke();
  certificateDocument.lineWidth(1.5).strokeColor('#f59e0b').rect(38, 38, pageWidth - 76, pageHeight - 76).stroke();

  certificateDocument.fillColor('#1e3a8a').font('Helvetica-Bold').fontSize(34).text('SelahTech Academy', 0, 90, { align: 'center' });
  certificateDocument.fillColor('#475569').font('Helvetica').fontSize(14).text('Learn · Build · Grow', { align: 'center' });

  certificateDocument.moveDown(1.5).fillColor('#0f172a').font('Helvetica-Bold').fontSize(26).text('Certificate of Completion', { align: 'center' });

  certificateDocument.moveDown(1).fillColor('#475569').font('Helvetica').fontSize(14).text('This certifies that', { align: 'center' });
  certificateDocument.moveDown(0.5).fillColor('#1e3a8a').font('Helvetica-Bold').fontSize(30).text(certificateDetails.studentFullName, { align: 'center' });
  certificateDocument.moveDown(0.5).fillColor('#475569').font('Helvetica').fontSize(14).text('has successfully completed the course', { align: 'center' });
  certificateDocument.moveDown(0.5).fillColor('#0f172a').font('Helvetica-Bold').fontSize(22).text(certificateDetails.courseTitle, { align: 'center' });

  certificateDocument
    .moveDown(2)
    .fillColor('#475569')
    .font('Helvetica')
    .fontSize(11)
    .text(`Issued on ${certificateDetails.issuedAt.toDateString()}   |   Certificate No. ${certificateDetails.certificateNumber}`, { align: 'center' });

  certificateDocument.end();
}
