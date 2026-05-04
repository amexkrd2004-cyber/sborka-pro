/**
 * Базовый URL API без завершающего слэша.
 * Задаётся в `.env`: EXPO_PUBLIC_API_URL=https://ваш-хост.up.railway.app
 */
export function getApiBase(): string {
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim() ?? '';
  if (!raw) {
    return '';
  }
  const withScheme =
    raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
  return withScheme.replace(/\/+$/, '');
}
