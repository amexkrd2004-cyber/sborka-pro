/** Отображение суммы в рублях (разделители по-русски). */
export function formatRubles(amount: number): string {
  return amount.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
