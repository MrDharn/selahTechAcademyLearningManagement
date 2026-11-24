import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { describePaymentKind, formatKoboAsNairaForReceipt } from '../services/paymentReceiptPdfRenderer';

describe('payment receipt wording', () => {
  it('says what the payment was for', () => {
    assert.equal(describePaymentKind('ENROLLMENT', false), 'Course enrollment');
    assert.equal(describePaymentKind('ENROLLMENT', true), 'Course enrollment (scholarship)');
    assert.equal(describePaymentKind('RENEWAL', false), 'Access renewal');
    assert.equal(describePaymentKind('RETAKE', false), 'Course retake');
  });

  it('prints the amount in naira with the NGN code (the PDF font has no naira sign)', () => {
    assert.equal(formatKoboAsNairaForReceipt(2_500_000), 'NGN 25,000.00');
    assert.equal(formatKoboAsNairaForReceipt(50_050), 'NGN 500.50');
  });
});
