// Present the existing 855 equivalence formula as Balatro-style Chips × Mult.
// Keep the unrounded numbers; formatting belongs to the view.
export function scoreFactors(result, input) {
  const chips = result.afterTaxValue / 2080;
  const time = 40 / result.wh.weighted;
  const growth = Number(input.growth ?? 1);
  const location = Number(input.locationFactor ?? 1);
  const mult = time * growth * location;
  return { chips, mult, time, growth, location, total: result.eqAfterHourly };
}
