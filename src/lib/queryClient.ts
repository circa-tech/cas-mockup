import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

export const authQueryScope = (idToken: string) => {
  const tokenFingerprint = hashToken(idToken);
  try {
    const payload = idToken.split(".")[1];
    if (payload) {
      const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
      const normalized = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
      const claims = JSON.parse(window.atob(normalized)) as { sub?: unknown; user_id?: unknown };
      const subject = claims.sub ?? claims.user_id;
      if (typeof subject === "string" && subject.length > 0) {
        return `${subject}:${tokenFingerprint}`;
      }
    }
  } catch {
    // Fall back to a non-reversible in-memory scope for non-JWT demo tokens.
  }

  return tokenFingerprint;
};

const hashToken = (idToken: string) => {
  let hash = 5381;
  for (let index = 0; index < idToken.length; index += 1) {
    hash = (hash * 33) ^ idToken.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
};
