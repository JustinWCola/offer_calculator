import test from 'node:test';
import assert from 'node:assert/strict';
import { sortOffers, multiplierHeat, productValue } from '../src/table-utils.js';

const offer = (name, hourly, monthly = 10000, hours = 40) => ({ id: name, name, input: { monthlyBase: monthly },
  result: hourly == null ? null : { eqAfterHourly: hourly, afterTaxValue: hourly * 2080, nominalTC: monthly * 12, wh: { actual: hours } } });
test('sorting supports direction, stable ties and invalid offers last without mutating the hand', () => {
  const hand = [offer('B', 20), offer('Bad', null), offer('A', 10), offer('Tie', 20)];
  assert.deepEqual(sortOffers(hand, 'hourly', 'desc').map(o => o.name), ['B', 'Tie', 'A', 'Bad']);
  assert.deepEqual(sortOffers(hand, 'hourly', 'asc').map(o => o.name), ['A', 'B', 'Tie', 'Bad']);
  assert.deepEqual(sortOffers(hand, 'name', 'asc').map(o => o.name), ['A', 'B', 'Bad', 'Tie']);
  assert.deepEqual(hand.map(o => o.name), ['B', 'Bad', 'A', 'Tie']);
});
test('monthly salary and work-hour sorting use the selected metric', () => {
  const hand = [offer('Low', 200, 10000, 55), offer('High', 100, 30000, 35)];
  assert.equal(sortOffers(hand, 'monthly')[0].name, 'High');
  assert.equal(sortOffers(hand, 'hours', 'asc')[0].name, 'High');
  assert.equal(sortOffers(hand, 'net')[0].name, 'Low');
});
test('multiplication distinguishes blank, invalid and zero values and enforces operand limits', () => {
  assert.equal(productValue(28000, 13), 364000);
  assert.equal(productValue(8, 5, 24, 5), 40);
  assert.equal(productValue(10000, 0), 0);
  for (const values of [['', 13], [' ', 13], [-1, 13], [Infinity, 1], [8, 6, 24, 5]]) assert.equal(productValue(...values), null);
});
test('fire intensity follows the multiplier relative to its meaningful baseline', () => {
  assert.equal(multiplierHeat(12, 12), 0);
  assert.equal(multiplierHeat(13, 12), 1);
  assert.equal(multiplierHeat(15, 12), 2);
  assert.equal(multiplierHeat(20, 12), 3);
  assert.equal(multiplierHeat(1.3), 2);
  assert.equal(multiplierHeat(NaN), 0);
});
