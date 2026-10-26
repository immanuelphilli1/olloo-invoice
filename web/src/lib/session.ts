import type { Business, Me } from '@olloo/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, get } from './api';

export const meKey = ['me'] as const;

/** The logged-in account, or null when logged out. */
export function useMe() {
  return useQuery({
    queryKey: meKey,
    queryFn: async () => {
      try {
        return await get<Me>('/auth/me');
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 30_000,
  });
}

export function useSetMe() {
  const qc = useQueryClient();
  return (me: Me | null) => qc.setQueryData(meKey, me);
}

export type Account = Me & { business: Business };

/** For pages behind <RequireBusiness>: the account with its business. */
export function useAccount(): Account {
  const { data } = useMe();
  if (!data?.business) throw new Error('useAccount used outside <RequireBusiness>');
  return data as Account;
}

/** Re-fetch account data after something that changes usage, plan or settings. */
export function useRefreshMe() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: meKey });
}
