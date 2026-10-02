const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 20,
});

export default function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? numberFormatter.format(number) : String(value ?? '');
}