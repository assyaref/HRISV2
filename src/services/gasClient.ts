/** Google Apps Script Web App transport. The URL is public by design. */
export const GAS_API_URL = import.meta.env.VITE_GAS_API_URL ||
  'https://script.google.com/macros/s/AKfycbyyLHD2TGa8jNvmUrvSlEVtbzgb-rOm7pzpwWZYoke--BILvksVsGDxvX96-ob3U71Sgw/exec';

export async function gasRequest<T>(action: string, payload: Record<string, unknown> = {}, token = ''): Promise<T> {
  const response = await fetch(GAS_API_URL, {
    method: 'POST',
    // text/plain avoids a CORS preflight request that Apps Script cannot answer.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, token, ...payload }),
  });
  if (!response.ok) throw new Error(`GAS tidak dapat diakses (${response.status})`);
  return response.json() as Promise<T>;
}
