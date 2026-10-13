import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from '../src/calculator.js';

test('hourly equivalence follows annual weighted hours across schedules, vacations and preferences', () => {
  const cases = [
    { monthlyBase: 28000, salaryMonths: 13, annualBonus: 30000 },
    { city: 'shanghai', monthlyBase: 34000, salaryMonths: 14, stock: 80000, stockFactor: .8, weekdayHours: 10, growth: 1.15 },
    { monthlyBase: 80000, weekdayHours: 12, weekendDays: 2, weekendHours: 6, growth: .9, locationFactor: 1.2 },
    { city: 'custom', monthlyBase: 10000, growth: 0 },
    { monthlyBase: 12000, annualLeave: 5, publicHolidays: 13, paidSickLeave: 3 },
    { monthlyBase: 0, option: 100000, optionFactor: 0, locationFactor: .8 },
  ];
  for (const input of cases) {
    const result = calculate(input);
    const expected = result.afterTaxValue * (input.growth ?? 1) * (input.locationFactor ?? 1) / result.wh.annualWeighted;
    assert.ok(Math.abs(expected - result.eqAfterHourly) <= Math.max(1, Math.abs(result.eqAfterHourly)) * 1e-12);
  }
});
