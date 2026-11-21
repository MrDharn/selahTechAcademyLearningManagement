import fs from 'fs';
import path from 'path';
import type PDFKit from 'pdfkit';

/** Details printed on the company's certificate of completion. */
export interface CertificateDetails {
  studentFullName: string;
  courseTitle: string;
  certificateNumber: string;
  issuedAt: Date;
}

/** Company details printed on every certificate. Change them here if they ever change. */
export const certificateIssuerDetails = {
  companyNameInCapitals: 'SELAH TECH ACADEMY',
  companyRegistrationNumber: '7502451',
  signatoryFullNameInCapitals: 'ROTIMI DAMILOLA',
  signatoryJobTitle: 'Program Manager',
} as const;

const brandNavyColor = '#0b2a5b';
const brandDeepNavyColor = '#07183a';
const brandGoldColor = '#e0a21b';
const brandLightGoldColor = '#f6cf6b';
const certificatePaperColor = '#f6f9ff';
const bodyTextColor = '#111827';

const certificateArtworkDirectory = path.resolve(__dirname, '../../assets');
const certificateLogoFilePath = path.join(certificateArtworkDirectory, 'certificate-logo.png');
const certificateSignatureFilePath = path.join(certificateArtworkDirectory, 'certificate-signature.png');

/** dd-mm-yyyy in the academy's time zone (Nigeria), e.g. 05-11-2026. */
export function formatCertificateDate(issuedAt: Date): string {
  return issuedAt.toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos', day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
}

/** Largest font size (up to maximumFontSize) at which the text still fits inside maximumWidth. */
function findFontSizeThatFits(document: PDFKit.PDFDocument, text: string, fontName: string, maximumFontSize: number, minimumFontSize: number, maximumWidth: number): number {
  let candidateFontSize = maximumFontSize;
  document.font(fontName);
  while (candidateFontSize > minimumFontSize && document.fontSize(candidateFontSize).widthOfString(text) > maximumWidth) {
    candidateFontSize -= 1;
  }
  return candidateFontSize;
}

/** The sweeping navy + gold ribbon in the top-right corner (also used, rotated, for the bottom-left corner). */
function drawCornerRibbon(document: PDFKit.PDFDocument, pageWidth: number) {
  document.save();
  document.path(`M ${pageWidth - 250} 0 L ${pageWidth - 170} 0 C ${pageWidth - 90} 50 ${pageWidth - 25} 140 ${pageWidth} 290 L ${pageWidth} 215 C ${pageWidth - 50} 120 ${pageWidth - 120} 40 ${pageWidth - 250} 0 Z`).fill(brandNavyColor);
  document.path(`M ${pageWidth - 170} 0 L ${pageWidth - 128} 0 C ${pageWidth - 62} 48 ${pageWidth - 14} 130 ${pageWidth} 215 L ${pageWidth} 180 C ${pageWidth - 40} 110 ${pageWidth - 100} 40 ${pageWidth - 170} 0 Z`).fill(brandGoldColor);
  document.path(`M ${pageWidth - 128} 0 L ${pageWidth - 108} 0 C ${pageWidth - 50} 42 ${pageWidth - 8} 110 ${pageWidth} 160 L ${pageWidth} 148 C ${pageWidth - 36} 100 ${pageWidth - 84} 36 ${pageWidth - 128} 0 Z`).fill(brandDeepNavyColor);
  document.restore();
}

/** The small gold L-shaped bracket in the top-left corner (also used, rotated, for the bottom-right corner). */
function drawCornerBracket(document: PDFKit.PDFDocument) {
  document.path('M 22 22 L 92 22 L 92 31 L 31 31 L 31 92 L 22 92 Z').fill(brandGoldColor);
  document.path('M 36 36 L 70 36 L 36 70 Z').fill(brandLightGoldColor);
}

/** Draws the rotated copy of a corner decoration on the opposite corner of the page. */
function drawOnOppositeCorner(document: PDFKit.PDFDocument, pageWidth: number, pageHeight: number, drawDecoration: () => void) {
  document.save();
  document.translate(pageWidth, pageHeight).rotate(180);
  drawDecoration();
  document.restore();
}

function drawAcademyEmblem(document: PDFKit.PDFDocument, centerX: number, centerY: number, emblemRadius: number) {
  if (fs.existsSync(certificateLogoFilePath)) {
    document.image(certificateLogoFilePath, centerX - emblemRadius, centerY - emblemRadius, { width: emblemRadius * 2, height: emblemRadius * 2 });
    return;
  }
  document.circle(centerX, centerY, emblemRadius).fill(brandNavyColor);
  document.circle(centerX, centerY, emblemRadius - 3).lineWidth(1.5).stroke(brandLightGoldColor);
  document.fillColor(brandLightGoldColor).font('Helvetica-Bold').fontSize(emblemRadius * 0.9)
    .text('ST', centerX - emblemRadius, centerY - emblemRadius * 0.45, { width: emblemRadius * 2, align: 'center' });
}

/** Gold scalloped rosette with a navy centre and two navy ribbon tails, like on the company certificate. */
function drawGoldSeal(document: PDFKit.PDFDocument, centerX: number, centerY: number) {
  const ribbonTailsPath = `M ${centerX - 34} ${centerY + 10} L ${centerX - 62} ${centerY + 62} L ${centerX - 40} ${centerY + 54} L ${centerX - 30} ${centerY + 74} L ${centerX - 6} ${centerY + 26} Z`;
  document.path(ribbonTailsPath).fill(brandNavyColor);
  document.path(`M ${centerX + 34} ${centerY + 10} L ${centerX + 62} ${centerY + 62} L ${centerX + 40} ${centerY + 54} L ${centerX + 30} ${centerY + 74} L ${centerX + 6} ${centerY + 26} Z`).fill(brandNavyColor);

  const numberOfScallops = 28;
  const scallopPoints: Array<[number, number]> = [];
  for (let pointIndex = 0; pointIndex < numberOfScallops * 2; pointIndex++) {
    const pointRadius = pointIndex % 2 === 0 ? 44 : 39;
    const pointAngle = (Math.PI * pointIndex) / numberOfScallops;
    scallopPoints.push([centerX + pointRadius * Math.cos(pointAngle), centerY + pointRadius * Math.sin(pointAngle)]);
  }
  document.polygon(...scallopPoints).fill(brandGoldColor);
  document.circle(centerX, centerY, 34).fill(brandLightGoldColor);
  document.circle(centerX, centerY, 31).fill(brandNavyColor);

  document.fillColor(brandLightGoldColor);
  const numberOfStars = 16;
  for (let starIndex = 0; starIndex < numberOfStars; starIndex++) {
    const starAngle = (2 * Math.PI * starIndex) / numberOfStars;
    document.circle(centerX + 25 * Math.cos(starAngle), centerY + 25 * Math.sin(starAngle), 1.6).fill(brandLightGoldColor);
  }
  document.circle(centerX, centerY, 17).fill('#123a7a');
}

export function drawCertificateOfCompletion(document: PDFKit.PDFDocument, certificateDetails: CertificateDetails) {
  const pageWidth = document.page.width;
  const pageHeight = document.page.height;
  const horizontalCenter = pageWidth / 2;

  // Paper, frame and corner decorations.
  document.rect(0, 0, pageWidth, pageHeight).fill(certificatePaperColor);
  document.lineWidth(7).strokeColor(brandNavyColor).rect(10, 10, pageWidth - 20, pageHeight - 20).stroke();
  document.lineWidth(1.2).strokeColor(brandGoldColor).rect(19, 19, pageWidth - 38, pageHeight - 38).stroke();
  drawCornerRibbon(document, pageWidth);
  drawOnOppositeCorner(document, pageWidth, pageHeight, () => drawCornerRibbon(document, pageWidth));
  drawCornerBracket(document);
  drawOnOppositeCorner(document, pageWidth, pageHeight, () => drawCornerBracket(document));

  // Emblem, academy name and registration number.
  drawAcademyEmblem(document, horizontalCenter, 62, 30);
  document.fillColor(brandNavyColor).font('Helvetica-Bold').fontSize(21)
    .text(certificateIssuerDetails.companyNameInCapitals, 0, 100, { width: pageWidth, align: 'center', characterSpacing: 3 });
  document.lineWidth(1).strokeColor(brandGoldColor)
    .moveTo(horizontalCenter - 120, 132).lineTo(horizontalCenter + 120, 132).stroke();
  document.fillColor(bodyTextColor).font('Helvetica-Bold').fontSize(11)
    .text(`RC: ${certificateIssuerDetails.companyRegistrationNumber}`, 0, 137, { width: pageWidth, align: 'center' });

  // "CERTIFICATE" headline with a gold outline, then the dark "OF COMPLETION" ribbon.
  document.font('Helvetica-Bold').fontSize(62).fillColor(brandNavyColor).strokeColor(brandGoldColor).lineWidth(1.6)
    .text('CERTIFICATE', 0, 158, { width: pageWidth, align: 'center', characterSpacing: 3, fill: true, stroke: true });

  const ribbonWidth = 290;
  const ribbonTop = 228;
  const ribbonHeight = 30;
  const ribbonLeft = horizontalCenter - ribbonWidth / 2;
  document.path(`M ${ribbonLeft} ${ribbonTop} L ${ribbonLeft + ribbonWidth} ${ribbonTop} L ${ribbonLeft + ribbonWidth - 14} ${ribbonTop + ribbonHeight / 2} L ${ribbonLeft + ribbonWidth} ${ribbonTop + ribbonHeight} L ${ribbonLeft} ${ribbonTop + ribbonHeight} L ${ribbonLeft + 14} ${ribbonTop + ribbonHeight / 2} Z`)
    .fillAndStroke(brandDeepNavyColor, brandGoldColor);
  document.fillColor('#ffffff').font('Helvetica-Bold').fontSize(14)
    .text('OF COMPLETION', ribbonLeft, ribbonTop + 8.5, { width: ribbonWidth, align: 'center', characterSpacing: 6 });

  // Recipient.
  document.fillColor(bodyTextColor).font('Helvetica').fontSize(14)
    .text('This certificate is presented to:', 0, 274, { width: pageWidth, align: 'center' });

  const recipientNameInCapitals = certificateDetails.studentFullName.toUpperCase();
  const recipientNameFontSize = findFontSizeThatFits(document, recipientNameInCapitals, 'Helvetica-Bold', 40, 18, pageWidth - 260);
  document.fillColor(brandNavyColor).strokeColor(brandNavyColor).lineWidth(0.6).font('Helvetica-Bold').fontSize(recipientNameFontSize)
    .text(recipientNameInCapitals, 0, 298, { width: pageWidth, align: 'center', fill: true, stroke: true });
  document.lineWidth(1).strokeColor(brandGoldColor)
    .moveTo(horizontalCenter - 230, 348).lineTo(horizontalCenter + 230, 348).stroke();

  const completionSentence = `For successfully completing the ${certificateDetails.courseTitle} course`;
  const completionSentenceFontSize = findFontSizeThatFits(document, completionSentence, 'Helvetica', 14, 9, pageWidth - 260);
  document.fillColor(bodyTextColor).font('Helvetica').fontSize(completionSentenceFontSize)
    .text(completionSentence, 0, 356, { width: pageWidth, align: 'center' });

  // Bottom row: date (left), gold seal (centre), signature (right).
  const bottomRowLineY = 488;
  const dateColumnCenterX = 190;
  const signatureColumnCenterX = pageWidth - 215;

  document.fillColor(bodyTextColor).font('Helvetica-Bold').fontSize(14)
    .text(formatCertificateDate(certificateDetails.issuedAt), dateColumnCenterX - 80, bottomRowLineY - 24, { width: 160, align: 'center' });
  document.lineWidth(1).strokeColor(brandGoldColor).moveTo(dateColumnCenterX - 80, bottomRowLineY).lineTo(dateColumnCenterX + 80, bottomRowLineY).stroke();
  document.fillColor(bodyTextColor).font('Helvetica-Bold').fontSize(9)
    .text('DATE', dateColumnCenterX - 80, bottomRowLineY + 6, { width: 160, align: 'center', characterSpacing: 1 });

  drawGoldSeal(document, horizontalCenter, 470);

  if (fs.existsSync(certificateSignatureFilePath)) {
    document.image(certificateSignatureFilePath, signatureColumnCenterX - 55, bottomRowLineY - 52, { fit: [110, 50], align: 'center' });
  }
  document.lineWidth(1).strokeColor(brandGoldColor).moveTo(signatureColumnCenterX - 90, bottomRowLineY).lineTo(signatureColumnCenterX + 90, bottomRowLineY).stroke();
  document.fillColor(bodyTextColor).font('Helvetica-Bold').fontSize(9)
    .text('SIGNATURE', signatureColumnCenterX - 90, bottomRowLineY + 6, { width: 180, align: 'center', characterSpacing: 1 });
  document.fillColor(brandNavyColor).font('Helvetica-Bold').fontSize(12)
    .text(certificateIssuerDetails.signatoryFullNameInCapitals, signatureColumnCenterX - 90, bottomRowLineY + 20, { width: 180, align: 'center' });
  document.fillColor(bodyTextColor).font('Helvetica').fontSize(10)
    .text(certificateIssuerDetails.signatoryJobTitle, signatureColumnCenterX - 90, bottomRowLineY + 36, { width: 180, align: 'center' });

  // Certificate number, small, so the certificate can be verified.
  document.fillColor('#475569').font('Helvetica').fontSize(8)
    .text(`Certificate No. ${certificateDetails.certificateNumber}`, 0, pageHeight - 36, { width: pageWidth, align: 'center' });
}
