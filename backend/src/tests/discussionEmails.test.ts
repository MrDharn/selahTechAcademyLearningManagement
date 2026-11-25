import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildNewQuestionEmail, buildQuestionAnsweredEmail } from '../services/emailTemplates';

describe('question e-mails', () => {
  const base = { recipientEmailAddress: 'a@b.com', courseTitle: 'Web <Dev>', lessonTitle: 'Intro', questionText: 'x'.repeat(400) };

  it('new-question e-mail escapes HTML, shortens long text and links to the answer page', () => {
    const email = buildNewQuestionEmail({ ...base, instructorFullName: 'Ada', studentDisplayName: 'Helen A.', answerPageUrl: 'https://site/instructor/courses/1' });
    assert.equal(email.subject, 'New question in Web <Dev>');
    assert.ok(email.htmlBody.includes('Web &lt;Dev&gt;'));
    assert.ok(!email.htmlBody.includes('x'.repeat(301)));
    assert.ok(email.plainTextBody.includes('https://site/instructor/courses/1'));
  });

  it('answered e-mail contains the answer and the lesson link', () => {
    const email = buildQuestionAnsweredEmail({ ...base, studentFullName: 'Helen', answerText: 'Use a <script>', lessonPageUrl: 'https://site/learn/1/lessons/2' });
    assert.ok(email.htmlBody.includes('Use a &lt;script&gt;'));
    assert.ok(email.plainTextBody.includes('https://site/learn/1/lessons/2'));
  });
});
