// Verified Beijing official notices; the calculator estimates a year at these monthly bases.
export const BEIJING_POLICY = {
  social: { min: 7270, max: 36348, period: '2026年7月起', source: 'https://rsj.beijing.gov.cn/xxgk/tzgg/202608/t20260821_4831468.html' },
  fund: { min: 2540, max: 36348, period: '2026年7月—2027年6月', source: 'https://www.beijing.gov.cn/zhengce/zhengcefagui/202608/t20260824_4834975.html' },
};
const legacyLimits = { socialMin: 7162, socialMax: 35811, fundMin: 2540, fundMax: 35811 };
export function migrateBeijingLimits(input) {
  // Migrate only the complete untouched former preset in automatic-base mode.
  // Explicitly edited limits and manual-base offers keep their saved values.
  if (input.city !== 'beijing' || input.baseMode !== 'salary' || !Object.entries(legacyLimits).every(([key, value]) => Number(input[key]) === value)) return input;
  return { ...input, socialMin: BEIJING_POLICY.social.min, socialMax: BEIJING_POLICY.social.max, fundMin: BEIJING_POLICY.fund.min, fundMax: BEIJING_POLICY.fund.max };
}
