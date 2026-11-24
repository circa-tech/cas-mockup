export type RegistrationLink = {
  state: "valid" | "expired" | "replaced" | "canceled" | "used" | "invalid";
  kind?: "invitation" | "reset";
  email?: string;
  role?: string;
};

const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";

export async function inspectRegistrationLink(token: string): Promise<RegistrationLink> {
  const response = await fetch(
    `${baseUrl}/api/v1/admin/registration/inspect`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error("No fue posible consultar el enlace.");
  return response.json() as Promise<RegistrationLink>;
}

export async function finishRegistration(
  token: string,
  password: string,
  name?: string,
): Promise<{ email: string; uid: string }> {
  const response = await fetch(
    `${baseUrl}/api/v1/admin/registration/complete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password, name }),
      cache: "no-store",
    },
  );
  const payload = await response.json() as {
    email?: string;
    uid?: string;
    detail?: string | { state: RegistrationLink["state"] };
  };
  if (!response.ok) {
    if (typeof payload.detail === "object" && payload.detail?.state) {
      throw new Error(registrationStateMessage(payload.detail.state));
    }
    if (response.status >= 500) {
      throw new Error("Tuvimos un problema de nuestro lado. Intenta de nuevo en unos minutos.");
    }
    throw new Error(typeof payload.detail === "string"
      ? payload.detail
      : "Tuvimos un problema de nuestro lado. Intenta de nuevo en unos minutos.");
  }
  return { email: payload.email!, uid: payload.uid! };
}

export function registrationStateMessage(state: RegistrationLink["state"]): string {
  switch (state) {
    case "expired":
      return "Este enlace venció. Pide a tu administradora que te genere uno nuevo.";
    case "replaced":
    case "canceled":
      return "Este enlace ya no está vigente. Pide a tu administradora que te genere uno nuevo.";
    case "used":
      return "Este enlace ya fue usado. Si ya creaste tu contraseña, inicia sesión.";
    default:
      return "El enlace no es válido. Copia la dirección completa o pide uno nuevo a tu administradora.";
  }
}
