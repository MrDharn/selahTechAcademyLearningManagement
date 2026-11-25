import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isDiscussionTextAcceptable, normalizeDiscussionText, orderQuestionsForInstructor } from '../rules/lessonQuestionRules';

describe('lesson question rules', () => {
  it('normalizes whitespace', () => {
    assert.equal(normalizeDiscussionText('  hello   world \n\n\n\n next '), 'hello world \n\n next');
  });
  it('rejects empty, tiny and huge text', () => {
    assert.equal(isDiscussionTextAcceptable('   \n '), false);
    assert.equal(isDiscussionTextAcceptable('hi'), false);
    assert.equal(isDiscussionTextAcceptable('How do I do this?'), true);
    assert.equal(isDiscussionTextAcceptable('a'.repeat(1001)), false);
  });
  it('puts unanswered (oldest first) before answered (newest first)', () => {
    const day = (dayNumber: number) => new Date(Date.UTC(2026, 10, dayNumber));
    const ordered = orderQuestionsForInstructor([
      { name: 'answered old', createdAt: day(1), answerCount: 1 },
      { name: 'unanswered new', createdAt: day(9), answerCount: 0 },
      { name: 'unanswered old', createdAt: day(3), answerCount: 0 },
      { name: 'answered new', createdAt: day(8), answerCount: 2 },
    ]).map((question) => question.name);
    assert.deepEqual(ordered, ['unanswered old', 'unanswered new', 'answered new', 'answered old']);
  });
});
