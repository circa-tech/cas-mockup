import { authQueryScope } from "./queryClient";

const scope = (idToken: string | null) =>
  idToken ? authQueryScope(idToken) : "anonymous";

export const queryKeys = {
  admin: {
    roles: (token: string | null) => ["admin", scope(token), "roles"] as const,
    users: (token: string | null) => ["admin", scope(token), "users"] as const,
  },
  etr: {
    root: (token: string | null) => ["et-lat", scope(token)] as const,
    resource: (
      token: string | null,
      path: string,
      params: Record<string, unknown> = {},
    ) => ["et-lat", scope(token), path, params] as const,
  },
  meteo: {
    snapshot: (token: string | null) =>
      ["weather-stations", scope(token), "snapshot"] as const,
  },
  snow: {
    basins: (token: string | null) =>
      ["modis-snow", scope(token), "basins-geojson"] as const,
    coverage: (token: string | null) =>
      ["modis-snow", scope(token), "coverage-series"] as const,
    image: (token: string | null) =>
      ["modis-snow", scope(token), "latest-image"] as const,
  },
  wells: {
    casMemberships: (token: string | null, casId: string) =>
      ["wells", scope(token), "cas-memberships", casId] as const,
    casOrganizations: (token: string | null) =>
      ["wells", scope(token), "cas"] as const,
    casUsers: (token: string | null) =>
      ["wells", scope(token), "cas-users"] as const,
    capabilities: (token: string | null) =>
      ["wells", scope(token), "admin-status"] as const,
    measurements: (token: string | null) =>
      ["wells", scope(token), "measurements"] as const,
    registry: (token: string | null, mine: boolean) =>
      ["wells", scope(token), mine ? "registry-mine" : "registry"] as const,
  },
};
