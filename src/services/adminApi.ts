export type AdminRole = {
  id: "general_admin" | "technical_admin" | "cas_user" | "public_user";
  label: string;
  permissions: string[];
};

export type AdminUser = {
  displayName: string | null;
  email: string | null;
  lastSignInAt: string | null;
  permissions: string[];
  role: AdminRole["id"];
  uid: string;
};

export type DailyActiveUsersResponse = {
  days: Array<{ activeUsers: number; date: string }>;
  timezone: string;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";

const requestAdmin = async <T>(
  path: string,
  idToken: string,
  options?: RequestInit,
): Promise<T> => {
  if (!apiBaseUrl) {
    throw new Error("Missing VITE_API_BASE_URL");
  }

  const response = await fetch(`${apiBaseUrl}/api/v1/admin/${path}`, {
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

  return response.json() as Promise<T>;
};

export const fetchAdminRoles = (idToken: string) =>
  requestAdmin<AdminRole[]>("roles", idToken);

export const fetchAdminUsers = (idToken: string) =>
  requestAdmin<AdminUser[]>("users", idToken);

export const fetchDailyActiveUsers = (idToken: string) =>
  requestAdmin<DailyActiveUsersResponse>("activity/daily", idToken);

export const updateAdminUserRole = (
  idToken: string,
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
