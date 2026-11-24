import { Droplets } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import {
  finishRegistration,
  inspectRegistrationLink,
  registrationStateMessage,
  type RegistrationLink,
} from "../../services/registrationApi";

const roleName: Record<string, string> = {
  general_admin: "General Admin",
  technical_admin: "Technical Admin",
  cas_user: "CAS User",
  public_user: "Public User",
};

export function RegistrationView({
  token,
  onComplete,
  onLogin,
}: {
  token: string;
  onComplete: (email: string, password: string) => Promise<void>;
  onLogin: () => void;
}) {
  const [link, setLink] = useState<RegistrationLink | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    void inspectRegistrationLink(token)
      .then((result) => { if (active) setLink(result); })
      .catch(() => {
        if (active) setLoadError("Tuvimos un problema de nuestro lado. Intenta de nuevo en unos minutos.");
      });
    return () => { active = false; };
  }, [token]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (password !== repeatPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (password.length < 6) {
      setError("Tu contraseña necesita al menos 6 caracteres.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await finishRegistration(token, password, link?.kind === "invitation" ? name : undefined);
      await onComplete(result.email, password);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message
        : "Tuvimos un problema de nuestro lado. Intenta de nuevo en unos minutos.";
      if (message.startsWith("Este enlace ya fue usado")) {
        setLink({ state: "used" });
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <div className="site-brand-icon" aria-hidden="true"><Droplets size={16} /></div>
          <div>
            <h1>Agua con Dato</h1>
            <p>Plataforma de información hídrica de las CAS del Valle de Copiapó</p>
          </div>
        </div>
        {!link && !loadError && <p>Comprobando el enlace...</p>}
        {loadError && <p role="alert" className="login-error">{loadError}</p>}
        {link && link.state !== "valid" && (
          <>
            <p role="alert" className="login-error">{registrationStateMessage(link.state)}</p>
            {link.state === "used" && <button type="button" onClick={onLogin}>Iniciar sesión</button>}
          </>
        )}
        {link?.state === "valid" && (
          <>
            <div className="login-copy">
              <h2>{link.kind === "invitation" ? "Te invitaron a Agua con Dato" : "Crea tu nueva contraseña"}</h2>
              <p>{link.kind === "invitation"
                ? `Crea tu cuenta para ingresar con ${link.email}. Tu rol será ${roleName[link.role ?? ""] ?? link.role}.`
                : `Esta será la contraseña para ingresar con ${link.email}.`}</p>
            </div>
            <form className="login-form" onSubmit={(event) => void onSubmit(event)}>
              {link.kind === "invitation" && (
                <label className="login-field">
                  <span>Nombre</span>
                  <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
                </label>
              )}
              <p className="registration-password-hint">La contraseña debe tener al menos 6 caracteres.</p>
              <label className="login-field">
                <span>Contraseña</span>
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password" required />
              </label>
              <label className="login-field">
                <span>Repetir contraseña</span>
                <input type="password" value={repeatPassword} onChange={(event) => setRepeatPassword(event.target.value)}
                  autoComplete="new-password" required />
              </label>
              {error && <p role="alert" className="login-error">{error}</p>}
              <button type="submit" className="login-password-btn" disabled={submitting}>
                {submitting ? "Guardando..." : link.kind === "invitation" ? "Crear cuenta" : "Guardar contraseña"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
