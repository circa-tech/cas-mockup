import { apiFetch } from "../offline/apiFetch";
export type AdminRole = {
  id: "general_admin" | "technical_admin" | "cas_user" | "public_user";
  label: string;
  permissions: string[];
  permissionLabels: Record<string, string>;
};

export type AdminUser = {
  displayName: string | null;
  email: string | null;
  lastSignInAt: string | null;
  permissions: string[];
  role: AdminRole["id"];
  uid: string;
};

export type PendingInvitation = {
  id: number;
  email: string;
  role: AdminRole["id"];
  invitedBy: string;
  invitedAt: string;
  expiresAt: string | null;
};

export type GeneratedLink = {
  id?: number;
  email: string;
  role?: AdminRole["id"];
  token: string;
  expiresAt: string;
};

export type DailyActiveUsersResponse = {
  days: Array<{ activeUsers: number; date: string }>;
  timezone: string;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";

const requestAdmin = async <T>(
  path: string,
  idToken: string | null,
  options?: RequestInit,
): Promise<T> => {
  if (!apiBaseUrl) {
    throw new Error("Missing VITE_API_BASE_URL");
  }

  const response = await apiFetch(`${apiBaseUrl}/api/v1/admin/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    let detail = `Admin ${path} request failed: ${response.status}`;
    try {
      const payload = (await response.json()) as { detail?: unknown };
      if (typeof payload.detail === "string") {
        detail = payload.detail;
      }
    } catch {
      // Keep the status fallback when the API does not return JSON.
    }
    throw new Error(detail);
  }

  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
};

export const fetchAdminRoles = (idToken: string | null) =>
  requestAdmin<AdminRole[]>("roles", idToken);

export const fetchAdminUsers = (idToken: string | null) =>
  requestAdmin<AdminUser[]>("users", idToken);

export const fetchInvitations = (idToken: string | null) =>
  requestAdmin<PendingInvitation[]>("invitations", idToken);

export const createInvitation = (idToken: string | null, email: string, role: AdminRole["id"]) =>
  requestAdmin<GeneratedLink>("invitations", idToken, {
    method: "POST",
    body: JSON.stringify({ email, role }),
  });

export const renewInvitation = (idToken: string | null, id: number) =>
  requestAdmin<GeneratedLink>(`invitations/${id}/link`, idToken, { method: "POST" });

export const cancelInvitation = (idToken: string | null, id: number) =>
  requestAdmin<void>(`invitations/${id}`, idToken, { method: "DELETE" });

export const updatePendingRole = (idToken: string | null, id: number, role: AdminRole["id"]) =>
  requestAdmin<PendingInvitation>(`invitations/${id}/role`, idToken, {
    method: "PUT",
    body: JSON.stringify({ role }),
  });

export const createResetLink = (idToken: string | null, uid: string) =>
  requestAdmin<GeneratedLink>(`users/${encodeURIComponent(uid)}/reset-link`, idToken, {
    method: "POST",
  });

export const fetchDailyActiveUsers = (idToken: string | null) =>
  requestAdmin<DailyActiveUsersResponse>("activity/daily", idToken);

export const updateAdminUserRole = (
  idToken: string | null,
  uid: string,
  role: AdminRole["id"],
) =>
  requestAdmin<{ permissions: string[]; role: AdminRole["id"]; uid: string }>(
    `users/${uid}/role`,
    idToken,
    {
      body: JSON.stringify({ role }),
      method: "PUT",
    },
  ).then(async (updated) => {
    await queryClient.invalidateQueries({
      queryKey: ["admin", authQueryScope(idToken), "users"],
    });
    return updated;
  });
import { authQueryScope, queryClient } from "../lib/queryClient";
