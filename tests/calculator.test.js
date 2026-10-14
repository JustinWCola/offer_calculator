import test from 'node:test';
import assert from 'node:assert/strict';
import { annualTax, bonusTax, calculate, cityPresets, rateOffer } from '../src/calculator.js';

const closeTo = (actual, expected, tolerance = 1e-6) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should equal ${expected}`);
};

const standardOffer = {
  city: 'custom',
  monthlyBase: 10000,
  salaryMonths: 12,
  weekdayHours: 8,
  weekdayDays: 5,
};

const seedOffer = {
  monthlyBase: 95000, salaryMonths: 15, monthlyAllowance: 0, allowanceMonths: 12,
  annualBonus: 0, bonusFactor: 1, bonusTax: 'separate',
  signOn: 400000, signFactor: 1, signTax: 'comprehensive',
  stock: 600000, stockFactor: 1, stockTax: 'equity',
  option: 0, optionFactor: 0.3, optionTax: 'equity',
  otherCash: 0, otherFactor: 1, otherTax: 'comprehensive',
  benefits: 0, benefitFactor: 0.5, city: 'beijing', baseMode: 'salary',
  socialBase: 30000, fundBase: 30000, pensionRate: 8, medicalRate: 2,
  unemploymentRate: 0.5, otherSocialRate: 0, fundRate: 12, contribMonths: 12,
  socialMin: 7162, socialMax: 35811, fundMin: 2540, fundMax: 35811, medicalFixed: 3,
  specialDeduction: 0, otherDeduction: 0,
  weekdayHours: 9, weekdayDays: 5, weekendDays: 0, weekendHours: 0,
  growth: 1, locationFactor: 1,
};

test('annual tax remains continuous at every annual bracket boundary', () => {
  const boundaries = [
    [36000, 1080, 0.03, 0.10],
    [144000, 11880, 0.10, 0.20],
    [300000, 43080, 0.20, 0.25],
    [420000, 73080, 0.25, 0.30],
    [660000, 145080, 0.30, 0.35],
    [960000, 250080, 0.35, 0.45],
  ];
  for (const [amount, tax, previousRate, nextRate] of boundaries) {
    closeTo(annualTax(amount), tax);
    closeTo(annualTax(amount - 1), tax - previousRate);
    closeTo(annualTax(amount + 1), tax + nextRate);
  }
  assert.equal(annualTax(0), 0);
  assert.equal(annualTax(-1000), 0);
});

test('separate annual bonus uses monthly quick deductions and preserves tax cliffs', () => {
  const boundaries = [
    [36000, 1080, 3390.10],
    [144000, 14190, 27390.20],
    [300000, 58590, 72340.25],
    [420000, 102340, 121590.30],
    [660000, 193590, 223840.35],
    [960000, 328840, 416840.45],
  ];
  for (const [amount, tax, nextTax] of boundaries) {
    closeTo(bonusTax(amount), tax);
    closeTo(bonusTax(amount + 1), nextTax);
  }
  assert.equal(bonusTax(0), 0);
  assert.equal(bonusTax(-1000), 0);
});

test('documented Seed offer reproduces the reference result', () => {
  const result = calculate(seedOffer);
  assert.equal(result.nominalTC, 2425000);
  assert.equal(result.adjustedTC, 2425000);
  closeTo(result.pension, 34378.56);
  closeTo(result.medical, 8630.64);
  closeTo(result.unemployment, 2148.66);
  closeTo(result.fund, 51567.84);
  closeTo(result.socialTotal, 96725.70);
  closeTo(result.taxableComp, 1668274.30);
  closeTo(result.taxComp, 568803.435);
  assert.equal(result.taxEquity, 127080);
  closeTo(result.taxTotal, 695883.435);
  closeTo(result.afterTaxValue, 1632390.865);
  assert.deepEqual(result.wh, { actual: 45, weighted: 47.5, annualActual: 2340, annualWeighted: 2470, scheduledDays: 260, workingDays: 260, leaveDays: 0 });
  closeTo(result.eqPretax, 2042105.2631578946);
  closeTo(result.eqAfter, 1374644.9389473684);
  closeTo(result.eqAfterHourly, 660.8869898785425);
  assert.equal(result.appliedSocialBase, 35811);
  assert.equal(result.appliedFundBase, 35811);
  assert.equal(result.rating.label, '夯');
});

test('855 has an identity time factor with zero custom-city contributions', () => {
  const result = calculate(standardOffer);
  assert.equal(result.salary, 120000);
  assert.equal(result.taxComp, 3480);
  assert.equal(result.socialTotal, 0);
  assert.equal(result.afterTaxValue, 116520);
  assert.deepEqual(result.wh, { actual: 40, weighted: 40, annualActual: 2080, annualWeighted: 2080, scheduledDays: 260, workingDays: 260, leaveDays: 0 });
  assert.equal(result.eqPretax, 120000);
  assert.equal(result.eqAfter, 116520);
  closeTo(result.eqAfterHourly, 56.01923076923077);
});

test('weekday overtime and weekend work receive 1.5 and 2 weights', () => {
  const result = calculate({ ...standardOffer, weekdayHours: 10, weekendDays: 1, weekendHours: 6 });
  assert.deepEqual(result.wh, { actual: 56, weighted: 67, annualActual: 2912, annualWeighted: 3484, scheduledDays: 312, workingDays: 312, leaveDays: 0 });
  closeTo(result.eqPretax, 71641.79104477611);
  closeTo(result.eqAfter, 69564.1791044776);
  closeTo(result.eqAfterHourly, 33.444316877152694);
  assert.equal(result.rating.label, '拉完了');
});

test('growth and location preferences affect equivalence without changing tax', () => {
  const result = calculate({ ...standardOffer, growth: 1.15, locationFactor: 0.8 });
  assert.equal(result.taxComp, 3480);
  assert.equal(result.afterTaxValue, 116520);
  closeTo(result.eqPretax, 110400);
  closeTo(result.eqAfter, 107198.4);
});

test('Beijing 2026 bases clamp salaries to both upper and lower limits', () => {
  const capped = calculate({ ...standardOffer, city: 'beijing', monthlyBase: 95000 });
  assert.equal(capped.appliedSocialBase, 36348);
  assert.equal(capped.appliedFundBase, 36348);
  closeTo(capped.socialTotal, 98175.60);
  const floor = calculate({ ...standardOffer, city: 'beijing', monthlyBase: 1000 });
  assert.equal(floor.appliedSocialBase, 7270);
  assert.equal(floor.appliedFundBase, 2540);
  closeTo(floor.pension, 6979.20);
  closeTo(floor.medical, 1780.80);
  closeTo(floor.unemployment, 436.20);
  closeTo(floor.fund, 3657.60);
  assert.equal(cityPresets.beijing.medicalFixed, 3);
});

test('custom bases, rates, fixed medical fee and part-year contributions are independent', () => {
  const result = calculate({
    ...standardOffer, monthlyBase: 50000, baseMode: 'custom',
    socialBase: 20000, fundBase: 10000, pensionRate: 8, medicalRate: 2,
    medicalFixed: 3, unemploymentRate: 0.5, otherSocialRate: 1,
    fundRate: 7, contribMonths: 6,
  });
  assert.equal(result.appliedSocialBase, 20000);
  assert.equal(result.appliedFundBase, 10000);
  assert.equal(result.pension, 9600);
  assert.equal(result.medical, 2418);
  assert.equal(result.unemployment, 600);
  assert.equal(result.otherSocial, 1200);
  assert.equal(result.fund, 4200);
  assert.equal(result.socialTotal, 18018);
  closeTo(result.taxComp, 103674.6);
  closeTo(result.afterTaxValue, 478307.4);
});

test('realization factors change offer value while tax uses nominal amounts', () => {
  const input = {
    ...standardOffer, stock: 100000, annualBonus: 20000, benefits: 10000,
    stockFactor: 0.5, bonusFactor: 0.8, benefitFactor: 0.5,
  };
  const discounted = calculate(input);
  const full = calculate({ ...input, stockFactor: 1, bonusFactor: 1, benefitFactor: 1 });
  assert.equal(discounted.nominalTC, 250000);
  assert.equal(discounted.adjustedTC, 191000);
  assert.equal(discounted.taxComp, 3480);
  assert.equal(discounted.taxBonus, 600);
  assert.equal(discounted.taxEquity, 7480);
  assert.equal(discounted.taxTotal, 11560);
  assert.equal(discounted.taxTotal, full.taxTotal);
  assert.equal(discounted.afterTaxValue, 179440);
  assert.equal(full.afterTaxValue - discounted.afterTaxValue, 59000);
});

test('tax-treatment selections send nominal income into the selected buckets', () => {
  const income = { ...standardOffer, annualBonus: 20000, signOn: 10000, stock: 100000, option: 5000, otherCash: 10000 };
  const separate = calculate(income);
  assert.equal(separate.taxComp, 5480);
  assert.equal(separate.taxBonus, 600);
  assert.equal(separate.taxEquity, 7980);
  const comprehensive = calculate({
    ...income, bonusTax: 'comprehensive', signTax: 'none',
    stockTax: 'comprehensive', optionTax: 'none', otherTax: 'none',
  });
  assert.equal(comprehensive.taxableComp, 180000);
  assert.equal(comprehensive.taxComp, 19080);
  assert.equal(comprehensive.taxBonus, 0);
  assert.equal(comprehensive.taxEquity, 0);
});

test('annual allowances and deductions use the declared annual amounts', () => {
  const result = calculate({ ...standardOffer, monthlyAllowance: 1000, allowanceMonths: 10, specialDeduction: 12000, otherDeduction: 8000 });
  assert.equal(result.allowance, 10000);
  assert.equal(result.taxableComp, 50000);
  assert.equal(result.taxComp, 2480);
  assert.equal(result.afterTaxValue, 127520);
});

test('all entertainment rating thresholds are inclusive', () => {
  for (const [hourly, label] of [[200, '夯'], [120, '顶级'], [70, '人上人'], [35, 'NPC'], [34.99, '拉完了']]) {
    assert.equal(rateOffer(hourly).label, label);
  }
});

test('invalid monetary values, modes, contribution bounds and work schedules are rejected', () => {
  const cases = [
    [{ monthlyBase: -1 }, /monthlyBase/],
    [{ monthlyBase: '' }, /monthlyBase/],
    [{ monthlyBase: ' ' }, /monthlyBase/],
    [{ monthlyBase: Number.NaN }, /monthlyBase/],
    [{ monthlyBase: Infinity }, /monthlyBase/],
    [{ stockFactor: 1.1 }, /stockFactor/],
    [{ fundRate: 101 }, /fundRate/],
    [{ contribMonths: 13 }, /contribMonths/],
    [{ allowanceMonths: 13 }, /allowanceMonths/],
    [{ city: 'invalid' }, /城市/],
    [{ baseMode: 'invalid' }, /baseMode/],
    [{ stockTax: 'separate' }, /stockTax/],
    [{ socialMin: 20000, socialMax: 10000 }, /下限/],
    [{ fundMin: 20000, fundMax: 10000 }, /下限/],
    [{ weekdayDays: 6 }, /weekdayDays/],
    [{ weekendDays: 3 }, /weekendDays/],
    [{ weekdayHours: 25 }, /weekdayHours/],
    [{ weekdayHours: 0 }, /每天工时/],
    [{ weekendDays: 1, weekendHours: 0 }, /每天工时/],
    [{ weekdayDays: 0, weekendDays: 0 }, /每周工时/],
  ];
  for (const [invalid, error] of cases) assert.throws(() => calculate({ ...standardOffer, ...invalid }), error);
  for (const fn of [annualTax, bonusTax, rateOffer]) assert.throws(() => fn(Infinity), /有限数字/);
  assert.throws(() => calculate({ ...standardOffer, weekdayHours: Number.MIN_VALUE, weekdayDays: 1 }), /有限数字/);
});

test('vacation discounts follow 52 weeks and 0.6 paid sick-leave weight without affecting taxes', () => {
  const input = {city:'custom', monthlyBase:10000, salaryMonths:12, weekdayDays:5, weekdayHours:8};
  const base = calculate(input), result = calculate({...input,annualLeave:5,publicHolidays:13,paidSickLeave:3});
  assert.equal(result.wh.workingDays,240.2);
  assert.ok(Math.abs(result.wh.annualWeighted-1921.6)<1e-9);
  assert.ok(Math.abs(result.eqAfterHourly - result.afterTaxValue/1921.6)<1e-9);
  assert.equal(result.taxTotal,base.taxTotal);
  assert.equal(result.socialTotal,base.socialTotal);
  assert.equal(calculate({...input,annualLeave:0,publicHolidays:0,paidSickLeave:0}).eqAfterHourly,base.eqAfterHourly);
  assert.throws(()=>calculate({...input,annualLeave:260}),/全年工作日/);
  assert.throws(()=>calculate({...input,paidSickLeave:-1}),/paidSickLeave/);
});
