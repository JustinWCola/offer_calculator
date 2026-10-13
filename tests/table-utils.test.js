import test from 'node:test';
import assert from 'node:assert/strict';
import { sortOffers, productHeat, configureSorting, productValue, displayedOffers, moveOffer, orderByIds, stepValue, migrateManualOrder, incomeTotals } from '../src/table-utils.js';

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
test('fire depends on the complete product, with independent annual-income and weekly-hour scales', () => {
  for (const value of [null, NaN, Infinity, -1, 0, 99999]) assert.equal(productHeat(value), 0);
  assert.equal(productHeat(100000), 1);
  assert.equal(productHeat(300000), 2);
  assert.equal(productHeat(500000), 3);
  assert.equal(productHeat(productValue(1000, 24)), 0);
  assert.equal(productHeat(productValue(50000, 12)), 3);
  assert.equal(productHeat(productValue(25000, 12)), productHeat(productValue(30000, 10)));
  assert.equal(productHeat(productValue(0, 24)), 0);
  assert.equal(productHeat(productValue(8, 4), 'hours'), 3);
  assert.equal(productHeat(productValue(8, 5), 'hours'), 2);
  assert.equal(productHeat(productValue(10, 5), 'hours'), 1);
  assert.equal(productHeat(productValue(12, 5), 'hours'), 0);
});

test('manual snapshots remain fixed on edits while automatic sorting recomputes without changing custom order', () => {
  const hand = [offer('A', 10), offer('B', 20), offer('C', 30)];
  const manual = { criterion: 'hourly', direction: 'desc', automatic: false, manualOrder: ['C', 'B', 'A'] };
  hand[0].result.eqAfterHourly = 40;
  assert.deepEqual(displayedOffers(hand, manual).map(o => o.id), ['C', 'B', 'A']);
  assert.deepEqual(displayedOffers(hand, { ...manual, automatic: true }).map(o => o.id), ['A', 'C', 'B']);
  assert.deepEqual(displayedOffers(hand, { ...manual, criterion: 'custom', automatic: true }).map(o => o.id), ['A', 'B', 'C']);
  assert.deepEqual(hand.map(o => o.id), ['A', 'B', 'C']);
});

test('reordering adopts the displayed order, preserves identity, and snapshot additions/deletions remain valid', () => {
  const hand = [offer('A', 10), offer('B', 20), offer('C', 30)];
  const sorted = sortOffers(hand, 'hourly');
  assert.deepEqual(moveOffer(sorted, 'A', 0).map(o => o.id), ['A', 'C', 'B']);
  assert.deepEqual(moveOffer(sorted, 'C', 2).map(o => o.id), ['B', 'A', 'C']);
  assert.deepEqual(orderByIds([...hand, offer('D', 40)], ['C', 'B', 'missing', 'A']).map(o => o.id), ['C', 'B', 'A', 'D']);
  assert.deepEqual(orderByIds(hand.slice(1), ['C', 'B', 'A']).map(o => o.id), ['C', 'B']);
  assert.equal(moveOffer(hand, 'missing', 0), hand);
});

test('value arrows respect decimals, blanks, zero and upper limits', () => {
  assert.equal(stepValue('0.3', 1, .05, 1), .35);
  assert.equal(stepValue('', 1, 500), 500);
  assert.equal(stepValue(0, -1, .5), 0);
  assert.equal(stepValue(5, 1, .5, 5), 5);
});

test('mode buttons apply rules immediately while manual edits remain frozen until re-sort', () => {
  const hand = [offer('A', 10), offer('B', 20)];
  const custom = { criterion: 'custom', lastCriterion: 'hourly', direction: 'desc', automatic: false, manualOrder: [] };
  const manual = configureSorting(hand, custom, { mode: 'manual' });
  assert.deepEqual(displayedOffers(hand, manual).map(o => o.id), ['B', 'A']);
  hand[0].result.eqAfterHourly = 30;
  assert.deepEqual(displayedOffers(hand, manual).map(o => o.id), ['B', 'A']);
  const refreshed = configureSorting(hand, manual, { mode: 'manual' });
  assert.deepEqual(displayedOffers(hand, refreshed).map(o => o.id), ['A', 'B']);
  const automatic = configureSorting(hand, custom, { mode: 'automatic' });
  assert.deepEqual(displayedOffers(hand, automatic).map(o => o.id), ['A', 'B']);
  const ascending = configureSorting(hand, automatic, { direction: 'asc' });
  assert.deepEqual(displayedOffers(hand, ascending).map(o => o.id), ['B', 'A']);
});

test('custom mode remembers the last metric and returning to metric mode does not overwrite custom order', () => {
  const hand = [offer('A', 10, 20000), offer('B', 20, 10000)];
  const manual = configureSorting(hand, { criterion: 'custom', direction: 'desc', manualOrder: [] }, { mode: 'manual', criterion: 'monthly' });
  const custom = configureSorting(hand, manual, { mode: 'custom' });
  assert.equal(custom.criterion, 'custom');
  assert.equal(custom.lastCriterion, 'monthly');
  assert.equal(custom.automatic, false);
  assert.deepEqual(displayedOffers(hand, custom).map(o => o.id), ['A', 'B']);
  const automatic = configureSorting(hand, custom, { mode: 'automatic' });
  assert.equal(automatic.criterion, 'monthly');
  assert.equal(automatic.automatic, true);
  const changedRule = configureSorting(hand, manual, { criterion: 'hourly' });
  assert.deepEqual(displayedOffers(hand, changedRule).map(o => o.id), ['B', 'A']);
  assert.deepEqual(hand.map(o => o.id), ['A', 'B']);
});

test('removed manual mode migrates its visible order without losing offers or changing automatic/custom order', () => {
  const hand = [offer('A', 10), offer('B', 20), offer('C', 30)];
  const old = { criterion: 'hourly', automatic: false, manualOrder: ['C', 'A', 'B'] };
  assert.deepEqual(migrateManualOrder(hand, old).map(o => o.id), ['C', 'A', 'B']);
  assert.equal(migrateManualOrder(hand, { ...old, automatic: true }), hand);
  assert.equal(migrateManualOrder(hand, { ...old, criterion: 'custom' }), hand);
  assert.equal(migrateManualOrder(hand, null), hand);
});

test('group totals include folded incomes and realization factors independently of tax/work inputs', () => {
  const input = { monthlyBase: 28000, monthlyAllowance: 1000, salaryMonths: 13, allowanceMonths: 12,
    annualBonus: 30000, bonusFactor: .5, signOn: 50000, signFactor: 1, stock: 80000, stockFactor: .8 };
  assert.deepEqual(incomeTotals(input), { monthly: 29000, annual: 129000, recurringAnnual: 376000 });
  assert.equal(incomeTotals({ ...input, weekdayHours: '' }).annual, 129000);
  assert.equal(incomeTotals({ ...input, stockFactor: 2 }).annual, null);
  assert.equal(incomeTotals({ ...input, monthlyAllowance: '' }).monthly, null);
  assert.deepEqual(incomeTotals({ monthlyBase: 0, salaryMonths: 12 }), { monthly: 0, annual: 0, recurringAnnual: 0 });
});

test('monthly income headline totals products with different payment months', () => {
 assert.equal(incomeTotals({ monthlyBase: 34000, salaryMonths: 14, monthlyAllowance: 1000, allowanceMonths: 10 }).recurringAnnual, 486000);
 assert.equal(incomeTotals({ monthlyBase: 34000, salaryMonths: '' }).recurringAnnual, null);
});

test('each income item uses its own annual-product thresholds, and less work burns more', () => {
  assert.equal(productHeat(24000, 'monthlyAllowance'), 2);
  assert.equal(productHeat(24000, 'monthlyBase'), 0);
  assert.equal(productHeat(60000, 'annualBonus'), 2);
  assert.equal(productHeat(60000, 'stock'), 1);
  assert.equal(productHeat(150000, 'option'), 3);
  assert.equal(productHeat(30000, 'benefits'), 3);
  assert.equal(productHeat(45, 'weekdayHours'), 1);
  assert.equal(productHeat(40, 'weekdayHours'), 2);
  assert.equal(productHeat(32, 'weekdayHours'), 3);
  assert.equal(productHeat(0, 'weekdayHours'), 0);
  assert.equal(productHeat(0, 'weekendHours'), 3);
  assert.equal(productHeat(5, 'weekendHours'), 2);
  assert.equal(productHeat(10, 'weekendHours'), 1);
  assert.equal(productHeat(11, 'weekendHours'), 0);
  assert.equal(productHeat(null, 'weekendHours'), 0);
  assert.equal(productHeat(0, 'invalid'), 0);
});
