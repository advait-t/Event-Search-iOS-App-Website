export interface Favorite {
  event_id?: string;
  name: string;
  date: string;
  venue: string;
  time?: string;
  genre?: string;
  segment?: string;
  subgenre?: string;
  type?: string;
  subtype?: string;
}

const storageKey = 'favourite_events';

export function readFavorites(): Favorite[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    return Array.isArray(saved) ? saved.filter(item => typeof item?.name === 'string') : [];
  } catch {
    return [];
  }
}

export function writeFavorites(favorites: Favorite[]): void {
  localStorage.setItem(storageKey, JSON.stringify(favorites));
}

export function matchesFavorite(saved: Favorite, event: Favorite): boolean {
  if (saved.event_id) return saved.event_id === event.event_id;
  // Older favorites store the event name, date, and venue but have no event ID.
  return saved.name === event.name && saved.date === event.date && saved.venue === event.venue &&
    (!saved.time || saved.time === event.time);
}
