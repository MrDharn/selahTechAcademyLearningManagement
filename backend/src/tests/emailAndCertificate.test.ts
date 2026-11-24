import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatCertificateDate } from '../services/certificatePdfRenderer';
import { buildAccessReminderEmail, buildPasswordResetEmail } from '../services/emailTemplates';

describe('e-mail templates', () => {
  it('escape a hostile name so it cannot inject HTML', () => {
    const email = buildPasswordResetEmail({
      recipientEmailAddress: 'student@example.com',
      fullName: '<script>alert(1)</script>',
      passwordResetPageUrl: 'https://academy.example/reset-password?token=abc',
      linkValidForMinutes: 60,
    });
    assert.ok(!email.htmlBody.includes('<script>'));
    assert.ok(email.htmlBody.includes('&lt;script&gt;'));
  });

  it('password reset e-mail carries the link in both HTML and plain text', () => {
    const email = buildPasswordResetEmail({
      recipientEmailAddress: 'student@example.com',
      fullName: 'Ada',
      passwordResetPageUrl: 'https://academy.example/reset-password?token=abc',
      linkValidForMinutes: 60,
    });
    assert.ok(email.htmlBody.includes('https://academy.example/reset-password?token=abc'));
    assert.ok(email.plainTextBody?.includes('https://academy.example/reset-password?token=abc'));
  });

  it('the two reminder e-mails differ: access ending vs last chance', () => {
    const commonDetails = {
      recipientEmailAddress: 'student@example.com',
      studentFullName: 'Ada',
      courseTitle: 'Web Development',
      relevantDeadline: new Date('2026-12-20T12:00:00Z'),
      renewalPageUrl: 'https://academy.example/courses/1',
    };
    const endingSoon = buildAccessReminderEmail({ ...commonDetails, reminderKind: 'ACCESS_ENDING_SOON' });
    const lastChance = buildAccessReminderEmail({ ...commonDetails, reminderKind: 'GRACE_PERIOD_ENDING_SOON' });
    assert.ok(endingSoon.subject.includes('ends on'));
    assert.ok(lastChance.subject.startsWith('Last chance'));
  });
});

describe('certificate date', () => {
  it('is printed as dd-mm-yyyy', () => {
    assert.equal(formatCertificateDate(new Date('2026-11-05T10:00:00Z')), '05-11-2026');
  });
  it('uses the Nigerian date: 23:30 UTC is already the next day in Lagos', () => {
    assert.equal(formatCertificateDate(new Date('2026-11-05T23:30:00Z')), '06-11-2026');
  });
});
