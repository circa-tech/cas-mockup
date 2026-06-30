import { Droplets } from "lucide-react";
import { useState, type FormEvent } from "react";

type LoginViewProps = {
  onBack: () => void;
  onEmailPasswordLogin: (email: string, password: string) => Promise<void>;
  onGoogleLogin: () => Promise<void>;
};

export function LoginView({
  onBack,
  onGoogleLogin,
  onEmailPasswordLogin,
}: LoginViewProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEmailPasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await onEmailPasswordLogin(email, password);
    } catch {
      setErrorMessage("No fue posible iniciar sesión con email y contraseña.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSubmit = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await onGoogleLogin();
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: unknown }).code)
          : null;
      setErrorMessage(
        code
          ? `No fue posible iniciar sesion con Google (${code}).`
          : "No fue posible iniciar sesion con Google.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <div className="site-brand-icon" aria-hidden="true">
            <Droplets size={16} />
          </div>
          <div>
            <h1>Agua con Dato</h1>
            <p>Mockup de acceso para usuarios y administradores.</p>
          </div>
        </div>

        <div className="login-copy">
          <h2>Iniciar sesión</h2>
          <p>
            Acceso con Google o email/contraseña para consultar los snapshots horarios
            publicados desde la plataforma CAS.
          </p>
        </div>

        <form className="login-form" onSubmit={handleEmailPasswordSubmit}>
          <label className="login-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="usuario@ejemplo.com"
              autoComplete="email"
              required
            />
          </label>
          <label className="login-field">
            <span>Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="********"
              autoComplete="current-password"
              required
            />
          </label>
          {errorMessage ? <p className="login-error">{errorMessage}</p> : null}
          <button type="submit" className="login-password-btn" disabled={isSubmitting}>
            {isSubmitting ? "Ingresando..." : "Ingresar con email"}
          </button>
        </form>

        <div className="login-divider" aria-hidden="true">
          <span />
          <strong>o</strong>
          <span />
        </div>

        <button
          type="button"
          className="login-google-btn"
          onClick={handleGoogleSubmit}
          disabled={isSubmitting}
        >
          <span className="login-google-mark" aria-hidden="true">G</span>
          Continuar con Google
        </button>
        <button type="button" className="login-back-btn" onClick={onBack}>
          Volver al dashboard
        </button>
      </div>
    </div>
  );
}
