const API_BASE = import.meta.env.VITE_API_BASE ?? '';
const API = API_BASE + '/api';

/** Base URL for image assets (thumbnail, background). Same origin as API so /images works via proxy; set VITE_API_BASE in production. */
export function getImageUrl(path: string | undefined): string {
  if (!path || path.startsWith('placeholder://')) return '';
  const normalized = path.replace(/\\/g, '/').trim();
  const rel = normalized.startsWith('images/') ? normalized : `images/${normalized}`;
  return `${API_BASE}/${rel}`;
}

export async function fetchSongs(): Promise<{ id: string; title: string; info: string[] }[]> {
  const r = await fetch(`${API}/songs`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function fetchSong(id: string): Promise<unknown> {
  const r = await fetch(`${API}/songs/${encodeURIComponent(id)}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function fetchNotationMapping(): Promise<unknown> {
  const r = await fetch(`${API}/notation-mapping`);
  if (!r.ok) return {};
  return r.json();
}

export async function fetchArrangements(songId: string): Promise<unknown[]> {
  const r = await fetch(`${API}/songs/${encodeURIComponent(songId)}/arrangements`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function fetchArrangement(songId: string, arrId: number): Promise<unknown> {
  const r = await fetch(`${API}/songs/${encodeURIComponent(songId)}/arrangements/${arrId}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function createArrangement(
  songId: string,
  data: { name?: string; tempo_bpm?: number; divisions?: number; beats?: number; beat_type?: number; note_data?: unknown }
): Promise<{ id: number }> {
  const r = await fetch(`${API}/songs/${encodeURIComponent(songId)}/arrangements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function updateArrangement(
  songId: string,
  arrId: number,
  data: { name?: string; tempo_bpm?: number; divisions?: number; beats?: number; beat_type?: number; note_data?: unknown }
): Promise<void> {
  const r = await fetch(`${API}/songs/${encodeURIComponent(songId)}/arrangements/${arrId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error(await r.text());
}

export async function deleteArrangement(songId: string, arrId: number): Promise<void> {
  const r = await fetch(`${API}/songs/${encodeURIComponent(songId)}/arrangements/${arrId}`, {
    method: 'DELETE',
  });
  if (!r.ok) throw new Error(await r.text());
}
