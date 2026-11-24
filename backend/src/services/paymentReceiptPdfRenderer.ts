import type PDFKit from 'pdfkit';
import { certificateIssuerDetails, formatCertificateDate } from './certificatePdfRenderer';

export interface PaymentReceiptDetails {
  receiptNumber: string; // the Paystack reference
  paidAt: Date;
  studentFullName: string;
  studentEmailAddress: string;
  courseTitle: string;
  paymentKind: 'ENROLLMENT' | 'RENEWAL' | 'RETAKE';
  isScholarshipPayment: boolean;
  amountInKobo: number;
}

const brandNavyColor = '#0b2a5b';
const brandGoldColor = '#e0a21b';
const mutedTextColor = '#64748b';
const bodyTextColor = '#111827';

export function describePaymentKind(paymentKind: PaymentReceiptDetails['paymentKind'], isScholarshipPayment: boolean): string {
  if (paymentKind === 'RENEWAL') return 'Access renewal';
  if (paymentKind === 'RETAKE') return 'Course retake';
  return isScholarshipPayment ? 'Course enrollment (scholarship)' : 'Course enrollment';
}

/** "NGN 25,000.00". The PDF's built-in font has no naira sign, so the currency code is used. */
export function formatKoboAsNairaForReceipt(amountInKobo: number): string {
  return `NGN ${(amountInKobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function drawPaymentReceipt(document: PDFKit.PDFDocument, receiptDetails: PaymentReceiptDetails) {
  const pageWidth = document.page.width;
  const contentLeft = 56;
  const contentRight = pageWidth - 56;
  const contentWidth = contentRight - contentLeft;

  // Header band.
  document.rect(0, 0, pageWidth, 110).fill(brandNavyColor);
  document.rect(0, 110, pageWidth, 4).fill(brandGoldColor);
  document.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22)
    .text(certificateIssuerDetails.companyNameInCapitals, contentLeft, 36, { width: contentWidth, characterSpacing: 2 });
  document.fillColor('#f6cf6b').font('Helvetica').fontSize(10)
    .text(`RC: ${certificateIssuerDetails.companyRegistrationNumber}`, contentLeft, 66, { width: contentWidth });

  // Title + receipt number + date.
  document.fillColor(brandNavyColor).font('Helvetica-Bold').fontSize(26).text('PAYMENT RECEIPT', contentLeft, 150, { width: contentWidth });
  document.fillColor(mutedTextColor).font('Helvetica').fontSize(10)
    .text('Receipt number', contentLeft, 196)
    .text('Date paid', contentLeft + 280, 196);
  document.fillColor(bodyTextColor).font('Helvetica-Bold').fontSize(12)
    .text(receiptDetails.receiptNumber, contentLeft, 210, { width: 260 })
    .text(formatCertificateDate(receiptDetails.paidAt), contentLeft + 280, 210, { width: 200 });

  // Received from.
  document.fillColor(mutedTextColor).font('Helvetica').fontSize(10).text('Received from', contentLeft, 250);
  document.fillColor(bodyTextColor).font('Helvetica-Bold').fontSize(13).text(receiptDetails.studentFullName, contentLeft, 264, { width: contentWidth });
  document.fillColor(mutedTextColor).font('Helvetica').fontSize(11).text(receiptDetails.studentEmailAddress, contentLeft, 282, { width: contentWidth });

  // Line item.
  const tableTop = 330;
  document.rect(contentLeft, tableTop, contentWidth, 28).fill('#eef3fb');
  document.fillColor(brandNavyColor).font('Helvetica-Bold').fontSize(10)
    .text('DESCRIPTION', contentLeft + 12, tableTop + 9)
    .text('AMOUNT', contentLeft, tableTop + 9, { width: contentWidth - 12, align: 'right' });

  document.fillColor(bodyTextColor).font('Helvetica-Bold').fontSize(12).text(receiptDetails.courseTitle, contentLeft + 12, tableTop + 44, { width: contentWidth - 190 });
  document.fillColor(mutedTextColor).font('Helvetica').fontSize(10)
    .text(describePaymentKind(receiptDetails.paymentKind, receiptDetails.isScholarshipPayment), contentLeft + 12, tableTop + 62, { width: contentWidth - 190 });
  document.fillColor(bodyTextColor).font('Helvetica').fontSize(12)
    .text(formatKoboAsNairaForReceipt(receiptDetails.amountInKobo), contentLeft, tableTop + 44, { width: contentWidth - 12, align: 'right' });

  document.lineWidth(1).strokeColor(brandGoldColor).moveTo(contentLeft, tableTop + 96).lineTo(contentRight, tableTop + 96).stroke();

  // Total.
  document.fillColor(brandNavyColor).font('Helvetica-Bold').fontSize(13)
    .text('TOTAL PAID', contentLeft + 12, tableTop + 112)
    .text(formatKoboAsNairaForReceipt(receiptDetails.amountInKobo), contentLeft, tableTop + 112, { width: contentWidth - 12, align: 'right' });

  // Payment details.
  document.fillColor(mutedTextColor).font('Helvetica').fontSize(10)
    .text('Payment method', contentLeft + 12, tableTop + 160)
    .text('Status', contentLeft + 280, tableTop + 160);
  document.fillColor(bodyTextColor).font('Helvetica-Bold').fontSize(11)
    .text('Paystack (online)', contentLeft + 12, tableTop + 175)
    .text('PAID', contentLeft + 280, tableTop + 175);

  // Footer.
  document.fillColor(mutedTextColor).font('Helvetica').fontSize(9)
    .text('Thank you for learning with us. This receipt was generated automatically and is valid without a signature.', contentLeft, 760, { width: contentWidth, align: 'center' });
}
