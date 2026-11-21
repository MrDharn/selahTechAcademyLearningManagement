import { environmentConfiguration } from '../configuration/environmentConfiguration';
import { prismaDatabaseClient } from '../database/prismaDatabaseClient';
import { sendEmail } from './emailDeliveryService';
import { buildAccessReminderEmail, type AccessReminderKind } from './emailTemplates';

/** How many days before a deadline the reminder is sent. */
export const REMINDER_LEAD_TIME_IN_DAYS = 7;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Sends the two reminders (once each per enrollment, renewing resets them):
 *  1. ACCESS_ENDING_SOON: paid access ends within 7 days.
 *  2. GRACE_PERIOD_ENDING_SOON: access already ended and the grace period closes within 7 days.
 * Returns how many e-mails were sent.
 */
export async function sendDueAccessExpiryReminders(currentDate: Date = new Date()): Promise<number> {
  const reminderWindowEnd = new Date(currentDate.getTime() + REMINDER_LEAD_TIME_IN_DAYS * MILLISECONDS_PER_DAY);

  const [enrollmentsEndingSoon, enrollmentsInFinalGraceWeek] = await Promise.all([
    prismaDatabaseClient.enrollment.findMany({
      where: { expiryReminderSentAt: null, accessExpiresAt: { gt: currentDate, lte: reminderWindowEnd } },
      include: { studentUser: true, course: { select: { id: true, title: true } } },
    }),
    prismaDatabaseClient.enrollment.findMany({
      where: {
        graceReminderSentAt: null,
        accessExpiresAt: { lte: currentDate },
        gracePeriodEndsAt: { gt: currentDate, lte: reminderWindowEnd },
      },
      include: { studentUser: true, course: { select: { id: true, title: true } } },
    }),
  ]);

  let numberOfRemindersSent = 0;

  const sendReminders = async (
    enrollments: typeof enrollmentsEndingSoon,
    reminderKind: AccessReminderKind,
    reminderSentColumn: 'expiryReminderSentAt' | 'graceReminderSentAt',
  ) => {
    for (const enrollment of enrollments) {
      if (!enrollment.studentUser.isAccountActive) continue;

      // Claim the reminder first. If two workers (or two server copies) run at once, only one gets count === 1.
      const reminderClaim = await prismaDatabaseClient.enrollment.updateMany({
        where: { id: enrollment.id, [reminderSentColumn]: null },
        data: { [reminderSentColumn]: currentDate },
      });
      if (reminderClaim.count !== 1) continue;

      const wasAccepted = await sendEmail(
        buildAccessReminderEmail({
          recipientEmailAddress: enrollment.studentUser.emailAddress,
          studentFullName: enrollment.studentUser.fullName,
          courseTitle: enrollment.course.title,
          reminderKind,
          relevantDeadline: reminderKind === 'ACCESS_ENDING_SOON' ? enrollment.accessExpiresAt : enrollment.gracePeriodEndsAt,
          renewalPageUrl: `${environmentConfiguration.frontendBaseUrl}/courses/${enrollment.course.id}`,
        }),
      );

      if (wasAccepted) {
        numberOfRemindersSent += 1;
      } else {
        // The mail server refused it: release the claim so the next run tries again.
        await prismaDatabaseClient.enrollment.updateMany({ where: { id: enrollment.id }, data: { [reminderSentColumn]: null } });
      }
    }
  };

  await sendReminders(enrollmentsEndingSoon, 'ACCESS_ENDING_SOON', 'expiryReminderSentAt');
  await sendReminders(enrollmentsInFinalGraceWeek, 'GRACE_PERIOD_ENDING_SOON', 'graceReminderSentAt');
  return numberOfRemindersSent;
}
