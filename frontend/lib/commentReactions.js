// Mock comment-reactions store backed by localStorage. Backend doesn't yet
// support emoji reactions on comments, so this lets us prototype the UX.
// Each comment has a JSON array of { emoji, userId } stored under
// `comment_reactions:<commentId>`.

import { useCallback, useEffect, useState } from 'react';

const KEY_PREFIX = 'comment_reactions:';
const EVENT_NAME = 'comment-reactions-changed';

function readStore(commentId) {
  if (typeof window === 'undefined' || !commentId) return [];
  try {
    const raw = window.localStorage.getItem(`${KEY_PREFIX}${commentId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStore(commentId, list) {
  if (typeof window === 'undefined' || !commentId) return;
  try {
    if (!list || list.length === 0) {
      window.localStorage.removeItem(`${KEY_PREFIX}${commentId}`);
    } else {
      window.localStorage.setItem(`${KEY_PREFIX}${commentId}`, JSON.stringify(list));
    }
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { commentId } }));
  } catch {
    // ignore
  }
}

// Aggregate raw reaction list into [{ emoji, count, mine }] entries,
// preserving first-seen emoji order for stable rendering.
function aggregateReactions(rawList, currentUserId) {
  const order = [];
  const map = new Map();
  for (const item of rawList) {
    const emoji = item?.emoji;
    if (!emoji) continue;
    if (!map.has(emoji)) {
      order.push(emoji);
      map.set(emoji, { emoji, count: 0, mine: false });
    }
    const bucket = map.get(emoji);
    bucket.count += 1;
    if (currentUserId !== null && currentUserId !== undefined && String(item.userId) === String(currentUserId)) {
      bucket.mine = true;
    }
  }
  return order.map((emoji) => map.get(emoji));
}

export function useCommentReactions(commentId, currentUserId) {
  const [reactions, setReactions] = useState(() =>
    aggregateReactions(readStore(commentId), currentUserId),
  );

  useEffect(() => {
    setReactions(aggregateReactions(readStore(commentId), currentUserId));
    function handle(event) {
      if (!event?.detail || String(event.detail.commentId) !== String(commentId)) return;
      setReactions(aggregateReactions(readStore(commentId), currentUserId));
    }
    if (typeof window !== 'undefined') {
      window.addEventListener(EVENT_NAME, handle);
      return () => window.removeEventListener(EVENT_NAME, handle);
    }
    return undefined;
  }, [commentId, currentUserId]);

  const toggleReaction = useCallback(
    (emoji) => {
      if (!commentId || !emoji) return;
      const userKey = currentUserId === null || currentUserId === undefined ? 'anon' : String(currentUserId);
      const list = readStore(commentId);
      const existingIndex = list.findIndex(
        (item) => item.emoji === emoji && String(item.userId) === userKey,
      );
      let next;
      if (existingIndex >= 0) {
        next = list.filter((_, idx) => idx !== existingIndex);
      } else {
        next = [...list, { emoji, userId: userKey }];
      }
      writeStore(commentId, next);
    },
    [commentId, currentUserId],
  );

  return { reactions, toggleReaction };
}
