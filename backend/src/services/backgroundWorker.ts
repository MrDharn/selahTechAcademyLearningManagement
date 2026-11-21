import { environmentConfiguration } from '../configuration/environmentConfiguration';
import { sendDueAccessExpiryReminders } from './accessExpiryReminderService';
import { deleteExpiredPasswordResetTokens } from './passwordResetService';

/**
 * The background worker: a small scheduler that runs inside the API process (no Redis or extra container needed).
 * Every job is safe to run twice and safe to run on two server copies at once, so this can later be moved into
 * its own process or service without changing the jobs. See README ("Background worker").
 */
const WORKER_RUN_INTERVAL_IN_MINUTES = 60;
const DELAY_BEFORE_FIRST_RUN_IN_SECONDS = 20;

interface BackgroundJob {
  jobName: string;
  runJob: () => Promise<string>;
}

const backgroundJobs: BackgroundJob[] = [
  {
    jobName: 'access-expiry-reminders',
    runJob: async () => {
      // Without a mail server there is nothing to send, and the reminders must not be marked as sent.
      if (!environmentConfiguration.emailDelivery.smtpHostName) return 'skipped (SMTP_HOST is not set)';
      return `${await sendDueAccessExpiryReminders()} e-mail(s) sent`;
    },
  },
  {
    jobName: 'delete-expired-password-reset-tokens',
    runJob: async () => `${await deleteExpiredPasswordResetTokens()} deleted`,
  },
];

let isWorkerRunInProgress = false;
let scheduledTimers: NodeJS.Timeout[] = [];

async function runAllBackgroundJobsOnce() {
  if (isWorkerRunInProgress) return; // never overlap two runs
  isWorkerRunInProgress = true;
  try {
    for (const backgroundJob of backgroundJobs) {
      try {
        const jobResultDescription = await backgroundJob.runJob();
        console.info(`[background worker] ${backgroundJob.jobName}: ${jobResultDescription}`);
      } catch (jobError) {
        // One failing job must not stop the others or crash the server.
        console.error(`[background worker] ${backgroundJob.jobName} failed:`, jobError);
      }
    }
  } finally {
    isWorkerRunInProgress = false;
  }
}

export function startBackgroundWorker() {
  scheduledTimers.push(setTimeout(() => void runAllBackgroundJobsOnce(), DELAY_BEFORE_FIRST_RUN_IN_SECONDS * 1000));
  scheduledTimers.push(setInterval(() => void runAllBackgroundJobsOnce(), WORKER_RUN_INTERVAL_IN_MINUTES * 60 * 1000));
  console.info(`[background worker] started: runs every ${WORKER_RUN_INTERVAL_IN_MINUTES} minutes`);
}

export function stopBackgroundWorker() {
  scheduledTimers.forEach((timer) => {
    clearTimeout(timer);
    clearInterval(timer);
  });
  scheduledTimers = [];
}
