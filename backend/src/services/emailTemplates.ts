import type { OutgoingEmail } from './emailDeliveryService';

const BRAND_BLUE_COLOUR = '#0b69b0';
const ACADEMY_NAME = 'Selah Tech Academy';

function escapeHtml(untrustedText: string): string {
  return untrustedText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatKoboAsNaira(amountInKobo: number): string {
  return `₦${(amountInKobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCalendarDate(dateToFormat: Date): string {
  return dateToFormat.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' });
}

/** Shared layout: a simple, table-free card that renders well in Gmail, Outlook and phone mail apps. */
function wrapInEmailLayout(headingText: string, bodyHtml: string, buttonLabel: string, buttonUrl: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#1f2d3d;">
    <div style="max-width:560px;margin:0 auto;padding:24px 12px;">
      <div style="background:${BRAND_BLUE_COLOUR};color:#ffffff;padding:20px 24px;border-radius:10px 10px 0 0;font-size:18px;font-weight:bold;">
        ${ACADEMY_NAME}
      </div>
      <div style="background:#ffffff;padding:28px 24px;border-radius:0 0 10px 10px;line-height:1.6;font-size:15px;">
        <h1 style="margin:0 0 16px;font-size:22px;color:#072f57;">${escapeHtml(headingText)}</h1>
        ${bodyHtml}
        <p style="margin:28px 0;text-align:center;">
          <a href="${escapeHtml(buttonUrl)}" style="background:${BRAND_BLUE_COLOUR};color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:999px;font-weight:bold;display:inline-block;">${escapeHtml(buttonLabel)}</a>
        </p>
        <p style="margin:0;font-size:12px;color:#6b7a8c;">You received this e-mail because of activity on your ${ACADEMY_NAME} account.</p>
      </div>
    </div>
  </body>
</html>`;
}

export interface RegistrationEmailDetails {
  studentFullName: string;
  signInPageUrl: string;
  coursesPageUrl: string;
}

export function buildRegistrationWelcomeEmail(details: RegistrationEmailDetails & { recipientEmailAddress: string }): OutgoingEmail {
  const bodyHtml = `
    <p>Hi ${escapeHtml(details.studentFullName)},</p>
    <p>Your account has been created successfully. You can now sign in, browse our courses and start learning.</p>
    <p>Your sign-in e-mail address is <strong>${escapeHtml(details.recipientEmailAddress)}</strong>.</p>`;

  return {
    recipientEmailAddress: details.recipientEmailAddress,
    subject: `Welcome to ${ACADEMY_NAME} - your registration was successful`,
    htmlBody: wrapInEmailLayout('Welcome aboard! 🎓', bodyHtml, 'Browse courses', details.coursesPageUrl),
    plainTextBody:
      `Hi ${details.studentFullName},\n\nYour ${ACADEMY_NAME} account has been created successfully.\n` +
      `Sign in with ${details.recipientEmailAddress} here: ${details.signInPageUrl}\nBrowse courses: ${details.coursesPageUrl}\n`,
  };
}

export interface PaymentEmailDetails {
  recipientEmailAddress: string;
  studentFullName: string;
  courseTitle: string;
  amountPaidInKobo: number;
  paymentReference: string;
  paymentCompletedAt: Date;
  accessExpiresAt: Date | null;
  gracePeriodEndsAt: Date | null;
  isScholarshipPayment: boolean;
  myLearningPageUrl: string;
}

export function buildPaymentSuccessEmail(details: PaymentEmailDetails): OutgoingEmail {
  const isFreeEnrollment = details.amountPaidInKobo === 0;
  const amountText = isFreeEnrollment ? 'Free' : formatKoboAsNaira(details.amountPaidInKobo);

  const tableRows: Array<[string, string]> = [
    ['Course', details.courseTitle],
    ['Amount', amountText + (details.isScholarshipPayment && !isFreeEnrollment ? ' (scholarship price)' : '')],
    ['Reference', details.paymentReference],
    ['Date', formatCalendarDate(details.paymentCompletedAt)],
  ];
  if (details.accessExpiresAt) tableRows.push(['Access until', formatCalendarDate(details.accessExpiresAt)]);
  if (details.gracePeriodEndsAt) tableRows.push(['Grace period ends', formatCalendarDate(details.gracePeriodEndsAt)]);

  const tableHtml = tableRows
    .map(
      ([rowLabel, rowValue]) =>
        `<tr><td style="padding:8px 12px;color:#6b7a8c;border-bottom:1px solid #e5eaf0;">${escapeHtml(rowLabel)}</td>` +
        `<td style="padding:8px 12px;font-weight:bold;border-bottom:1px solid #e5eaf0;">${escapeHtml(rowValue)}</td></tr>`,
    )
    .join('');

  const scholarshipNoteHtml = details.isScholarshipPayment
    ? '<p>You are enrolled through our scholarship program, so you can open the sections included in it. You can upgrade to the full course at any time.</p>'
    : '';

  const bodyHtml = `
    <p>Hi ${escapeHtml(details.studentFullName)},</p>
    <p>${isFreeEnrollment ? 'Your enrollment is confirmed.' : 'We have received your payment. Thank you!'} Your course is ready.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">${tableHtml}</table>
    ${scholarshipNoteHtml}`;

  return {
    recipientEmailAddress: details.recipientEmailAddress,
    subject: isFreeEnrollment
      ? `Enrollment confirmed: ${details.courseTitle}`
      : `Payment successful: ${details.courseTitle} (${amountText})`,
    htmlBody: wrapInEmailLayout(isFreeEnrollment ? 'You are enrolled!' : 'Payment successful ✅', bodyHtml, 'Start learning', details.myLearningPageUrl),
    plainTextBody:
      `Hi ${details.studentFullName},\n\n${isFreeEnrollment ? 'Your enrollment is confirmed.' : 'We have received your payment.'}\n\n` +
      tableRows.map(([rowLabel, rowValue]) => `${rowLabel}: ${rowValue}`).join('\n') +
      `\n\nStart learning: ${details.myLearningPageUrl}\n`,
  };
}

export function buildPasswordResetEmail(details: {
  recipientEmailAddress: string;
  fullName: string;
  passwordResetPageUrl: string;
  linkValidForMinutes: number;
}): OutgoingEmail {
  const bodyHtml = `
    <p>Hi ${escapeHtml(details.fullName)},</p>
    <p>We received a request to set a new password for your account. The button below is valid for ${details.linkValidForMinutes} minutes and works once.</p>
    <p>If you did not ask for this, you can ignore this e-mail. Your password stays the same.</p>`;

  return {
    recipientEmailAddress: details.recipientEmailAddress,
    subject: `Reset your ${ACADEMY_NAME} password`,
    htmlBody: wrapInEmailLayout('Reset your password', bodyHtml, 'Choose a new password', details.passwordResetPageUrl),
    plainTextBody:
      `Hi ${details.fullName},\n\nUse this link to choose a new password (valid for ${details.linkValidForMinutes} minutes, works once):\n` +
      `${details.passwordResetPageUrl}\n\nIf you did not ask for this, ignore this e-mail.\n`,
  };
}

export type AccessReminderKind = 'ACCESS_ENDING_SOON' | 'GRACE_PERIOD_ENDING_SOON';

export function buildAccessReminderEmail(details: {
  recipientEmailAddress: string;
  studentFullName: string;
  courseTitle: string;
  reminderKind: AccessReminderKind;
  relevantDeadline: Date;
  renewalPageUrl: string;
}): OutgoingEmail {
  const deadlineText = formatCalendarDate(details.relevantDeadline);
  const isGraceReminder = details.reminderKind === 'GRACE_PERIOD_ENDING_SOON';

  const headingText = isGraceReminder ? 'Last chance to renew' : 'Your course access ends soon';
  const messageHtml = isGraceReminder
    ? `<p>Your paid access to <strong>${escapeHtml(details.courseTitle)}</strong> has ended and you are in the grace period, which closes on <strong>${escapeHtml(deadlineText)}</strong>. Renew before then to keep your progress and continue learning.</p>`
    : `<p>Your access to <strong>${escapeHtml(details.courseTitle)}</strong> ends on <strong>${escapeHtml(deadlineText)}</strong>. Renew now and the extra time is added on top of what you have left, so nothing is lost.</p>`;

  const bodyHtml = `<p>Hi ${escapeHtml(details.studentFullName)},</p>${messageHtml}<p>Your progress and certificates are always kept.</p>`;

  return {
    recipientEmailAddress: details.recipientEmailAddress,
    subject: isGraceReminder
      ? `Last chance to renew: ${details.courseTitle}`
      : `Your access to ${details.courseTitle} ends on ${deadlineText}`,
    htmlBody: wrapInEmailLayout(headingText, bodyHtml, 'Renew my access', details.renewalPageUrl),
    plainTextBody:
      `Hi ${details.studentFullName},\n\n` +
      (isGraceReminder
        ? `Your access to "${details.courseTitle}" has ended and the grace period closes on ${deadlineText}.`
        : `Your access to "${details.courseTitle}" ends on ${deadlineText}.`) +
      `\n\nRenew here: ${details.renewalPageUrl}\n`,
  };
}

function shortenForEmail(longText: string, maximumCharacters = 300): string {
  return longText.length <= maximumCharacters ? longText : `${longText.slice(0, maximumCharacters - 1).trimEnd()}…`;
}

/** To the instructor: a student asked a question; the button opens the course editor where it can be answered. */
export function buildNewQuestionEmail(details: {
  recipientEmailAddress: string;
  instructorFullName: string;
  studentDisplayName: string;
  courseTitle: string;
  lessonTitle: string;
  questionText: string;
  answerPageUrl: string;
}): OutgoingEmail {
  const questionPreview = shortenForEmail(details.questionText);
  const bodyHtml =
    `<p>Hi ${escapeHtml(details.instructorFullName)},</p>` +
    `<p><strong>${escapeHtml(details.studentDisplayName)}</strong> asked a question in <strong>${escapeHtml(details.courseTitle)}</strong>, lesson “${escapeHtml(details.lessonTitle)}”:</p>` +
    `<blockquote style="margin:16px 0;padding:12px 16px;border-left:4px solid ${BRAND_BLUE_COLOUR};background:#f1f5f9;white-space:pre-wrap;">${escapeHtml(questionPreview)}</blockquote>` +
    `<p>Open the course page and scroll to <strong>Student questions</strong> to answer. The student is e-mailed when you reply.</p>`;

  return {
    recipientEmailAddress: details.recipientEmailAddress,
    subject: `New question in ${details.courseTitle}`,
    htmlBody: wrapInEmailLayout('A student asked a question', bodyHtml, 'Answer the question', details.answerPageUrl),
    plainTextBody:
      `Hi ${details.instructorFullName},\n\n${details.studentDisplayName} asked a question in "${details.courseTitle}", lesson "${details.lessonTitle}":\n\n` +
      `${questionPreview}\n\nAnswer it here: ${details.answerPageUrl}\n`,
  };
}

/** To the student: their question got an answer; the button opens the lesson. */
export function buildQuestionAnsweredEmail(details: {
  recipientEmailAddress: string;
  studentFullName: string;
  courseTitle: string;
  lessonTitle: string;
  questionText: string;
  answerText: string;
  lessonPageUrl: string;
}): OutgoingEmail {
  const answerPreview = shortenForEmail(details.answerText, 500);
  const bodyHtml =
    `<p>Hi ${escapeHtml(details.studentFullName)},</p>` +
    `<p>Your question in <strong>${escapeHtml(details.courseTitle)}</strong>, lesson “${escapeHtml(details.lessonTitle)}”, has an answer.</p>` +
    `<p style="color:#6b7a8c;white-space:pre-wrap;">You asked: ${escapeHtml(shortenForEmail(details.questionText, 200))}</p>` +
    `<blockquote style="margin:16px 0;padding:12px 16px;border-left:4px solid #12b76a;background:#ecfdf3;white-space:pre-wrap;">${escapeHtml(answerPreview)}</blockquote>`;

  return {
    recipientEmailAddress: details.recipientEmailAddress,
    subject: `Your question was answered: ${details.courseTitle}`,
    htmlBody: wrapInEmailLayout('Your question was answered', bodyHtml, 'Open the lesson', details.lessonPageUrl),
    plainTextBody:
      `Hi ${details.studentFullName},\n\nYour question in "${details.courseTitle}" (${details.lessonTitle}) was answered:\n\n${answerPreview}\n\nOpen the lesson: ${details.lessonPageUrl}\n`,
  };
}
