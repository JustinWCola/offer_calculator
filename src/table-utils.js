export const SORT_OPTIONS = [
  ['hourly', '等效税后时薪'], ['net', '税后年收入'], ['package', '税前总包'],
  ['monthly', '税前月薪'], ['hours', '每周工时'], ['name', 'Offer 名称'],
];

export function sortOffers(offers, criterion, direction = 'desc') {
  if (criterion === 'custom') return [...offers];
  const sign = direction === 'asc' ? 1 : -1;
  const values = { hourly: 'eqAfterHourly', net: 'afterTaxValue', package: 'nominalTC' };
  const value = offer => criterion === 'monthly' ? (String(offer.input.monthlyBase ?? '').trim() === '' ? null : Number(offer.input.monthlyBase)) :
    criterion === 'hours' ? offer.result?.wh.actual : offer.result?.[values[criterion]];
  return offers.map((offer, index) => ({ offer, index })).sort((a, b) => {
    if (criterion === 'name') return sign * a.offer.name.localeCompare(b.offer.name, 'zh-CN', { numeric: true }) || a.index - b.index;
    const av = value(a.offer), bv = value(b.offer);
    const aValid = typeof av === 'number' && Number.isFinite(av), bValid = typeof bv === 'number' && Number.isFinite(bv);
    if (aValid !== bValid) return aValid ? -1 : 1;
    if (!aValid) return a.index - b.index;
    return sign * (av - bv) || a.index - b.index;
  }).map(({ offer }) => offer);
}

// Canonical offers retain the user's custom order. Manual sorting is a snapshot;
// automatic sorting is derived from current values and never rewrites that order.
export function orderByIds(offers, ids = []) {
  const rank = new Map(ids.map((id, index) => [id, index]));
  return offers.map((offer, index) => ({ offer, index })).sort((a, b) =>
    (rank.get(a.offer.id) ?? ids.length + a.index) - (rank.get(b.offer.id) ?? ids.length + b.index)
  ).map(({ offer }) => offer);
}

export function migrateManualOrder(offers, settings) {
  return settings && settings.criterion !== 'custom' && settings.automatic === false && Array.isArray(settings.manualOrder)
    ? orderByIds(offers, settings.manualOrder) : offers;
}

export function displayedOffers(offers, settings) {
  if (settings.criterion === 'custom') return offers;
  return settings.automatic ? sortOffers(offers, settings.criterion, settings.direction) : orderByIds(offers, settings.manualOrder);
}

export function moveOffer(offers, id, index) {
  const from = offers.findIndex(offer => offer.id === id);
  if (from < 0) return offers;
  const next = [...offers], [offer] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, index)), 0, offer);
  return next;
}

export function stepValue(raw, delta, step = 1, max = Number.MAX_SAFE_INTEGER) {
  const value = String(raw ?? '').trim() === '' ? 0 : Number(raw);
  return Math.min(max, Math.max(0, Number(((Number.isFinite(value) ? value : 0) + delta * step).toFixed(6))));
}

export function configureSorting(offers, settings, patch) {
  const validRule = value => SORT_OPTIONS.some(([key]) => key === value);
  const remembered = validRule(settings.criterion) ? settings.criterion : validRule(settings.lastCriterion) ? settings.lastCriterion : 'hourly';
  if (patch.mode === 'custom') return { ...settings, criterion: 'custom', automatic: false, manualOrder: [], lastCriterion: remembered };
  const criterion = validRule(patch.criterion) ? patch.criterion : remembered;
  const direction = patch.direction ?? settings.direction;
  const automatic = patch.mode === 'automatic' || (patch.mode !== 'manual' && settings.automatic);
  return { criterion, direction, automatic, lastCriterion: criterion,
    manualOrder: automatic ? settings.manualOrder : sortOffers(offers, criterion, direction).map(offer => offer.id) };
}

// Income uses annual yuan; work counters use weekly hours. A zero or invalid
// product never burns, regardless of either individual operand or recent edits.
export function productHeat(value, unit = 'income') {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const thresholds = unit === 'hours' ? [40, 50, 60] : [100000, 300000, 500000];
  return value >= thresholds[2] ? 3 : value >= thresholds[1] ? 2 : value >= thresholds[0] ? 1 : 0;
}

export function productValue(left, right, leftMax = Number.MAX_SAFE_INTEGER, rightMax = Number.MAX_SAFE_INTEGER) {
  const parse = (raw, max) => {
    if (raw == null || String(raw).trim() === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 && value <= max ? value : null;
  };
  const a = parse(left, leftMax), b = parse(right, rightMax);
  if (a === null || b === null || !Number.isFinite(a * b)) return null;
  return a * b;
}

export function incomeTotals(input) {
  const sum = values => values.some(value => value === null) || !Number.isFinite(values.reduce((a, b) => a + b, 0)) ? null : values.reduce((a, b) => a + b, 0);
  const monthly = sum([productValue(input.monthlyBase, 1), productValue(input.monthlyAllowance ?? 0, 1)]);
  const annual = sum([['annualBonus', 'bonusFactor', 1], ['signOn', 'signFactor', 1], ['stock', 'stockFactor', 1],
    ['option', 'optionFactor', .3], ['otherCash', 'otherFactor', 1], ['benefits', 'benefitFactor', .5]]
    .map(([amount, factor, fallback]) => productValue(input[amount] ?? 0, input[factor] ?? fallback, Number.MAX_SAFE_INTEGER, 1)));
  const recurringAnnual = sum([productValue(input.monthlyBase, input.salaryMonths), productValue(input.monthlyAllowance ?? 0, input.allowanceMonths ?? 12, Number.MAX_SAFE_INTEGER, 12)]);
  return { monthly, annual, recurringAnnual };
}
