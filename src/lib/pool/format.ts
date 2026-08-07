const formatter = (digits: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const formatNumber = (value: number, digits = 2) => formatter(digits).format(value);

export const formatMeasure = (value: number, unit: string, digits = 2) =>
  `${formatNumber(value, digits)} ${unit}`;
