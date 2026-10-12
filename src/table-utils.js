export const SORT_OPTIONS = [
  ['hourly', '等效税后时薪'], ['net', '税后年收入'], ['package', '税前总包'],
  ['monthly', '税前月薪'], ['hours', '每周工时'], ['name', 'Offer 名称'],
];

export function sortOffers(offers, criterion, direction = 'desc') {
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

export function multiplierHeat(value, baseline = 1) {
  if (!Number.isFinite(value) || !Number.isFinite(baseline) || baseline <= 0) return 0;
  const ratio = value / baseline;
  return ratio >= 1.6 ? 3 : ratio >= 1.25 ? 2 : ratio > 1.001 ? 1 : 0;
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
