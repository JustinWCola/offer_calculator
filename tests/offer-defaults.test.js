import test from 'node:test';
import assert from 'node:assert/strict';
import { NEW_OFFER_INPUT, REFERENCE_INPUT } from '../src/offer-defaults.js';
import { calculate } from '../src/calculator.js';
test('new offers start with unfilled salary and zero extra income; reference example matches upstream inputs', () => {
  assert.equal(NEW_OFFER_INPUT.monthlyBase, '');
  for (const key of ['annualBonus','monthlyAllowance','signOn','stock','option','otherCash','benefits']) assert.equal(NEW_OFFER_INPUT[key],0);
  assert.equal(NEW_OFFER_INPUT.weekdayHours,9);
  assert.equal(REFERENCE_INPUT.monthlyBase,95000);
  assert.equal(REFERENCE_INPUT.salaryMonths,15);
  assert.equal(REFERENCE_INPUT.signOn,400000);
  assert.equal(REFERENCE_INPUT.stock,600000);
  assert.equal(REFERENCE_INPUT.annualLeave,5);
  assert.equal(calculate(REFERENCE_INPUT).nominalTC,2425000);
});
