import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calculateDiscountedPriceInKobo,
  calculateRenewalPriceInKobo,
  calculateRetakePriceInKobo,
  SMALLEST_CHARGED_AMOUNT_IN_KOBO,
} from '../rules/coursePricingRules';

const COURSE_PRICE_100_000_NAIRA_IN_KOBO = 10_000_000;
const naira = (amountInNaira: number) => amountInNaira * 100;

describe('renewal price = half of the part of the course still left', () => {
  const expectedPricesByPercentageCovered: Array<[number, number]> = [
    [0, 50_000],
    [20, 40_000],
    [50, 25_000], // "1/4 of the price" when half the course is covered
    [80, 10_000], // half of the remaining 20%
    [99, 500],
  ];

  for (const [percentageCovered, expectedPriceInNaira] of expectedPricesByPercentageCovered) {
    it(`${percentageCovered}% covered costs ${expectedPriceInNaira} naira on a 100,000 naira course`, () => {
      assert.equal(calculateRenewalPriceInKobo(COURSE_PRICE_100_000_NAIRA_IN_KOBO, percentageCovered), naira(expectedPriceInNaira));
    });
  }

  it('gets cheaper the more of the course is covered', () => {
    let previousPrice = Infinity;
    for (let percentageCovered = 0; percentageCovered <= 99; percentageCovered++) {
      const price = calculateRenewalPriceInKobo(COURSE_PRICE_100_000_NAIRA_IN_KOBO, percentageCovered);
      assert.ok(price <= previousPrice, `price rose at ${percentageCovered}%`);
      previousPrice = price;
    }
  });

  it('rounds to a whole naira', () => {
    assert.equal(calculateRenewalPriceInKobo(1_234_500, 33) % 100, 0);
  });

  it('never makes a paid course free', () => {
    assert.equal(calculateRenewalPriceInKobo(150, 99), SMALLEST_CHARGED_AMOUNT_IN_KOBO);
  });

  it('keeps a free course free', () => {
    assert.equal(calculateRenewalPriceInKobo(0, 40), 0);
  });

  it('ignores impossible percentages instead of charging nonsense', () => {
    assert.equal(calculateRenewalPriceInKobo(COURSE_PRICE_100_000_NAIRA_IN_KOBO, -10), naira(50_000));
    assert.equal(calculateRenewalPriceInKobo(COURSE_PRICE_100_000_NAIRA_IN_KOBO, 250), SMALLEST_CHARGED_AMOUNT_IN_KOBO);
  });
});

describe('retake price', () => {
  it('is the full course price by default', () => {
    assert.equal(calculateRetakePriceInKobo(COURSE_PRICE_100_000_NAIRA_IN_KOBO), COURSE_PRICE_100_000_NAIRA_IN_KOBO);
  });
});

describe('scholarship discount', () => {
  it('50% off halves the price', () => {
    assert.equal(calculateDiscountedPriceInKobo(COURSE_PRICE_100_000_NAIRA_IN_KOBO, 50), naira(50_000));
  });
  it('0% off keeps the price and 100% off makes it free', () => {
    assert.equal(calculateDiscountedPriceInKobo(COURSE_PRICE_100_000_NAIRA_IN_KOBO, 0), COURSE_PRICE_100_000_NAIRA_IN_KOBO);
    assert.equal(calculateDiscountedPriceInKobo(COURSE_PRICE_100_000_NAIRA_IN_KOBO, 100), 0);
  });
  it('rounds to a whole kobo', () => {
    assert.equal(Number.isInteger(calculateDiscountedPriceInKobo(9_999_999, 33)), true);
  });
});
