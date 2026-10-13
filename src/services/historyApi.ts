import { apiFetch } from "../offline/apiFetch";
import { throwApiError } from "./apiError";
import type { HistoryRange } from "../utils/history";

export type HistoryPoint = {
  fecha: string;
  values: Record<string, number | null>;
  minimum: Record<string, number | null>;
  maximum: Record<string, number | null>;
  count: Record<string, number>;
};

export type HistoryResponse = HistoryRange & {
  series_id: string;
  available_from: string | null;
  available_to: string | null;
  resolution: "native" | "monthly";
  version: string;
  generated_at: string;
  points: HistoryPoint[];
};

export async function fetchHistory(
  module: "et-lat" | "modis-snow",
  params: Record<string, string | number>,
  idToken: string | null,
  signal?: AbortSignal,
): Promise<HistoryResponse> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "");
  if (!baseUrl) throw new Error("Missing VITE_API_BASE_URL");
  const query = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]));
  const response = await apiFetch(`${baseUrl}/api/v1/${module}/history?${query}`, {
    signal,
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!response.ok) await throwApiError(response, "Historial");
  return response.json() as Promise<HistoryResponse>;
}
