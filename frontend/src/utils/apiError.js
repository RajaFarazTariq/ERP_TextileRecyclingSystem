// Turn a failed API call into a readable message, e.g. the backend's
// "Only 300.00 kg of dried stock is available for this fabric".
export function apiErrorMessage(error, fallback = 'Something went wrong.') {
  const data = error?.response?.data;
  if (!data || typeof data !== 'object') return fallback;
  if (data.detail) return data.detail;
  const text = Object.values(data).flat().filter(v => typeof v === 'string').join(' ');
  return text || fallback;
}
