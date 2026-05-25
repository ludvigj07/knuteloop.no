import { useCallback, useEffect, useState } from 'react';

function getStorageKey(userId) {
  return userId ? `favoriteKnotIds:${userId}` : 'favoriteKnotIds:anon';
}

function normalizeId(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function readFromStorage(userId) {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map(normalizeId).filter(Boolean));
  } catch {
    return new Set();
  }
}

function writeToStorage(userId, ids) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      getStorageKey(userId),
      JSON.stringify([...ids]),
    );
  } catch {
    // ignore quota / disabled storage
  }
}

export function useFavoriteKnots(userId) {
  const [favorites, setFavorites] = useState(() => readFromStorage(userId));

  useEffect(() => {
    setFavorites(readFromStorage(userId));
  }, [userId]);

  const toggleFavorite = useCallback(
    (knotId) => {
      const normalized = normalizeId(knotId);
      if (!normalized) return;
      setFavorites((current) => {
        const next = new Set(current);
        if (next.has(normalized)) {
          next.delete(normalized);
        } else {
          next.add(normalized);
        }
        writeToStorage(userId, next);
        return next;
      });
    },
    [userId],
  );

  const isFavorite = useCallback(
    (knotId) => favorites.has(normalizeId(knotId)),
    [favorites],
  );

  return { favorites, toggleFavorite, isFavorite };
}
