import { useEffect, useState } from 'react';

export interface Filters {
  q: string;
  status: string;
  from: string;
  to: string;
}

export const emptyFilters: Filters = { q: '', status: '', from: '', to: '' };

export const hasFilters = (f: Filters) => !!(f.q || f.status || f.from || f.to);

/** Debounced value — keeps list queries from firing on every keystroke. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
