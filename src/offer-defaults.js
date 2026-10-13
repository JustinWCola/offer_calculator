export const NEW_OFFER_INPUT = {
  city: 'beijing', monthlyBase: '', salaryMonths: 12, monthlyAllowance: 0, allowanceMonths: 12,
  annualBonus: 0, bonusFactor: 1, bonusTax: 'separate', signOn: 0, signFactor: 1, signTax: 'comprehensive',
  stock: 0, stockFactor: 1, stockTax: 'equity', option: 0, optionFactor: 0.3, optionTax: 'equity',
  otherCash: 0, otherFactor: 1, otherTax: 'comprehensive', benefits: 0, benefitFactor: 0.5,
  baseMode: 'salary', socialBase: 30000, fundBase: 30000, contribMonths: 12,
  specialDeduction: 0, otherDeduction: 0, weekdayDays: 5, weekdayHours: 9, weekendDays: 0, weekendHours: 0,
  growth: 1, locationFactor: 1, annualLeave: 0, publicHolidays: 0, paidSickLeave: 0,
};

// offer-calculate's reference example; holidays follow worth-calculator.
export const REFERENCE_INPUT = { ...NEW_OFFER_INPUT, monthlyBase: 95000, salaryMonths: 15, signOn: 400000, stock: 600000, annualLeave: 5, publicHolidays: 13, paidSickLeave: 3 };
