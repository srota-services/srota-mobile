import { useCallback, useState } from 'react';

interface UsePullToRefreshOptions {
   isRefetching?: boolean;
}

/**
 * Bundle React Query refetch callbacks for pull-to-refresh gestures.
 */
export function usePullToRefresh(
   refetchFns: (() => Promise<unknown>)[],
   options?: UsePullToRefreshOptions
): { refreshing: boolean; onRefresh: () => void } {
   const [localRefreshing, setLocalRefreshing] = useState(false);
   const isRefetching = options?.isRefetching ?? false;

   const onRefresh = useCallback(async () => {
      if (refetchFns.length === 0) {
         return;
      }

      setLocalRefreshing(true);
      try {
         await Promise.all(refetchFns.map((refetch) => refetch()));
      } finally {
         setLocalRefreshing(false);
      }
   }, [refetchFns]);

   return {
      refreshing: localRefreshing || isRefetching,
      onRefresh,
   };
}
