export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export const throwApiError = async (response: Response, label: string): Promise<never> => {
  let detail = "";

  try {
    const payload = (await response.clone().json()) as { detail?: unknown };
    if (typeof payload.detail === "string") {
      detail = payload.detail;
    } else if (Array.isArray(payload.detail)) {
      detail = payload.detail
        .map((item) => {
          if (!item || typeof item !== "object") {
            return "";
          }
          const record = item as { loc?: unknown; msg?: unknown };
          const location = Array.isArray(record.loc) ? record.loc.join(".") : "";
          const message = typeof record.msg === "string" ? record.msg : "";
          return [location, message].filter(Boolean).join(": ");
        })
        .filter(Boolean)
        .join("; ");
    }
  } catch {
    // Ignore non-JSON error bodies.
  }

  throw new ApiRequestError(
    detail ? `${label}: ${detail}` : `${label} request failed: ${response.status}`,
    response.status,
    detail,
  );
};
