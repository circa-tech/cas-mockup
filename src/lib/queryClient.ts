import { QueryCache, QueryClient } from "@tanstack/react-query";
import { getOfflineState } from "../offline/state";
import { OfflineDataUnavailableError } from "../offline/apiFetch";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if ([401, 403, 404].includes((error as { status?: number }).status ?? 0)) {
        query.setState({ data: undefined });
      }
    },
  }),
  defaultOptions: {
    queries: {
      gcTime: 30 * 60 * 1000,
      // Query functions read IndexedDB even without a network connection.
      networkMode: "always",
      refetchOnReconnect: "always",
      refetchOnWindowFocus: false,
      retry: (count, error) => !(error instanceof OfflineDataUnavailableError) && count < 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

// The credential is deliberately excluded: refreshing it must not discard data.
// Auth installs this scope before mounting any authenticated query observers.
export const authQueryScope = (_idToken?: string | null) => getOfflineState().scope;
