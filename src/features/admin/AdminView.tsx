import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, KeyRound, Link2, MailPlus, Save, UserRound, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Panel } from "../../components/Panel";
import { RemoteDataState } from "../../components/RemoteDataState";
import { SimpleLineChart } from "../../components/SimpleLineChart";
import {
  fetchDailyActiveUsers,
  fetchAdminRoles,
  fetchAdminUsers,
  fetchInvitations,
  createInvitation,
  renewInvitation,
  cancelInvitation,
  updatePendingRole,
  createResetLink,
  updateAdminUserRole,
  type AdminRole,
  type AdminUser,
  type GeneratedLink,
} from "../../services/adminApi";
import { queryKeys } from "../../lib/queryKeys";

type AdminViewProps = {
  authIdToken: string | null;
  currentUserUid: string | null;
  authRole: string;
};

export function AdminView({ authIdToken, currentUserUid, authRole }: AdminViewProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<AdminRole["id"]>("cas_user");
  const [generated, setGenerated] = useState<{ link: GeneratedLink; kind: "invitation" | "reset" } | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [duplicatePendingId, setDuplicatePendingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const queryClient = useQueryClient();
  const enabled = Boolean(authIdToken);
  const canInvite = authRole === "general_admin";
  const rolesQuery = useQuery({
    queryKey: queryKeys.admin.roles(authIdToken),
    queryFn: () => fetchAdminRoles(authIdToken!),
    enabled,
    staleTime: 30 * 60 * 1000,
  });
  const usersQuery = useQuery({
    queryKey: queryKeys.admin.users(authIdToken),
    queryFn: () => fetchAdminUsers(authIdToken!),
    enabled,
    staleTime: 2 * 60 * 1000,
  });
  const invitationsQuery = useQuery({
    queryKey: ["admin", "invitations", authIdToken],
    queryFn: () => fetchInvitations(authIdToken!),
    enabled,
    staleTime: 30_000,
  });
  const dailyActivityQuery = useQuery({
    queryKey: queryKeys.admin.dailyActivity(authIdToken),
    queryFn: () => fetchDailyActiveUsers(authIdToken!),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
  const roles = rolesQuery.data ?? [];
  const permissionRoles = roles.filter((role) =>
    role.id === "general_admin" || role.id === "technical_admin" || role.id === "cas_user",
  );
  const permissionRows = Array.from(new Set(permissionRoles.flatMap((role) => role.permissions)))
    .map((permission) => ({
      id: permission,
      label: permissionRoles
        .map((role) => role.permissionLabels?.[permission])
        .find((label) => Boolean(label)),
    }))
    .filter((row): row is { id: string; label: string } => Boolean(row.label));
  const pending = invitationsQuery.data ?? [];
  useEffect(() => {
    const nextExpiry = (invitationsQuery.data ?? [])
      .map((row) => row.expiresAt ? Date.parse(row.expiresAt) : 0)
      .filter((expiresAt) => expiresAt > Date.now())
      .sort((left, right) => left - right)[0];
    if (!nextExpiry) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(1, nextExpiry - Date.now() + 1));
    return () => window.clearTimeout(timer);
  }, [invitationsQuery.data, now]);
  useEffect(() => {
    if (!inviteOpen && !generated) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setInviteOpen(false);
        setGenerated(null);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [inviteOpen, generated]);
  const users = [...(usersQuery.data ?? [])].sort((left, right) => {
    const leftTimestamp = left.lastSignInAt ? Date.parse(left.lastSignInAt) : 0;
    const rightTimestamp = right.lastSignInAt ? Date.parse(right.lastSignInAt) : 0;
    return rightTimestamp - leftTimestamp;
  });
  const dailyActivity = dailyActivityQuery.data;
  const loadStatus = !enabled
    ? "error"
    : rolesQuery.isPending || usersQuery.isPending || invitationsQuery.isPending || dailyActivityQuery.isPending
      ? "loading"
      : rolesQuery.isError || usersQuery.isError || invitationsQuery.isError || dailyActivityQuery.isError
        ? "error"
        : "ready";
  const roleMutation = useMutation({
    mutationFn: ({ role, uid }: { role: AdminRole["id"]; uid: string }) =>
      updateAdminUserRole(authIdToken!, uid, role),
    onSuccess: (updated) => {
      queryClient.setQueryData<AdminUser[]>(
        queryKeys.admin.users(authIdToken),
        (previous = []) =>
          previous.map((user) =>
            user.uid === updated.uid
              ? { ...user, role: updated.role, permissions: updated.permissions }
              : user,
          ),
      );
    },
  });
  const savingUid = roleMutation.isPending ? roleMutation.variables?.uid ?? null : null;
  const activeUsersToday = dailyActivity?.days.at(-1)?.activeUsers ?? 0;
  const dailyActivityMax = Math.max(
    1,
    ...(dailyActivity?.days.map((day) => day.activeUsers) ?? []),
  );
  const activitySeries = dailyActivity
    ? [
        {
          color: "hsl(205 62% 43%)",
          label: "Usuarios activos",
          points: dailyActivity.days.map((day) => ({
            label: new Intl.DateTimeFormat("es-CL", {
              day: "2-digit",
              month: "2-digit",
              timeZone: dailyActivity.timezone,
            }).format(new Date(`${day.date}T12:00:00Z`)),
            value: day.activeUsers,
          })),
        },
      ]
    : [];

  const handleRoleChange = async (uid: string, role: AdminRole["id"]) => {
    if (!authIdToken) {
      return;
    }
    if (uid === currentUserUid && role !== "general_admin") {
      setErrorMessage("No puedes quitarte el rol General Admin a ti mismo.");
      return;
    }

    setErrorMessage(null);

    try {
      await roleMutation.mutateAsync({ role, uid });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No fue posible actualizar el rol del usuario.",
      );
    }
  };

  const refreshInvitations = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "invitations", authIdToken] });

  const onInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authIdToken || !canInvite) return;
    const normalized = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
      setInviteError("El correo no parece válido.");
      return;
    }
    if (selectedRole === "general_admin" &&
      !window.confirm("Esta persona tendrá acceso completo como General Admin. ¿Quieres continuar?")) return;
    setInviteError(null);
    setNotice(null);
    setDuplicatePendingId(null);
    setBusy(true);
    try {
      const link = await createInvitation(authIdToken, normalized, selectedRole);
      setGenerated({ link, kind: "invitation" });
      setCopyStatus("idle");
      setNotice(`Invitación creada para ${normalized}. Copia el mensaje y envíaselo.`);
      setInviteOpen(false);
      setEmail("");
      await refreshInvitations();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No fue posible crear la invitación.";
      setInviteError(message);
      if (message.includes("Ya hay una invitación pendiente")) {
        setDuplicatePendingId(pending.find((row) => row.email === email.trim().toLowerCase())?.id ?? null);
      }
    } finally {
      setBusy(false);
    }
  };

  const onRenew = async (id: number) => {
    if (!authIdToken || !canInvite) return;
    if (inviteOpen) setInviteError(null);
    else setErrorMessage(null);
    setBusy(true);
    try {
      const link = await renewInvitation(authIdToken, id);
      setGenerated({ link, kind: "invitation" });
      setCopyStatus("idle");
      setInviteOpen(false);
      await refreshInvitations();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No fue posible generar el enlace.";
      if (inviteOpen) setInviteError(message);
      else setErrorMessage(message);
    } finally {
      setBusy(false);
    }
  };

  const onReset = async (uid: string) => {
    if (!authIdToken || !canInvite) return;
    setErrorMessage(null);
    setBusy(true);
    try {
      const link = await createResetLink(authIdToken, uid);
      setGenerated({ link, kind: "reset" });
      setCopyStatus("idle");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No fue posible generar el enlace.");
    } finally {
      setBusy(false);
    }
  };

  const onCancel = async (id: number, targetEmail: string) => {
    if (!authIdToken || !canInvite ||
      !window.confirm(`¿Cancelar la invitación a ${targetEmail}? El enlace dejará de funcionar.`)) return;
    setErrorMessage(null);
    setBusy(true);
    try {
      await cancelInvitation(authIdToken, id);
      await refreshInvitations();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No fue posible cancelar la invitación.");
    } finally {
      setBusy(false);
    }
  };

  const onPendingRole = async (id: number, role: AdminRole["id"]) => {
    if (!authIdToken || !canInvite) return;
    if (role === "general_admin" &&
      !window.confirm("Esta persona tendrá acceso completo como General Admin. ¿Quieres continuar?")) return;
    setErrorMessage(null);
    try {
      await updatePendingRole(authIdToken, id, role);
      await refreshInvitations();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No fue posible actualizar el rol.");
    }
  };

  return (
    <div className="view-stack admin-view">
      <div className="view-intro">
        <h2>Administracion de usuarios</h2>
        <p>Roles de acceso para la plataforma.</p>
      </div>

      {loadStatus === "loading" && (
        <RemoteDataState
          title="Cargando usuarios"
          message="Consultando Firebase Auth."
        />
      )}

      {loadStatus === "error" && (
        <RemoteDataState
          title="No fue posible cargar administracion"
          message={
            errorMessage ??
            (!enabled
              ? "No hay token de sesión disponible."
              : "No fue posible cargar usuarios y roles.")
          }
          tone="error"
        />
      )}

      {loadStatus === "ready" && (
        <>
          {canInvite && inviteOpen && (
            <div className="admin-modal-backdrop">
              <div className="admin-modal admin-invite-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-invite-title">
                <div className="admin-modal-heading">
                  <span className="admin-modal-icon" aria-hidden="true"><MailPlus size={20} /></span>
                  <button className="admin-icon-button" type="button" aria-label="Cerrar invitación" onClick={() => { setInviteOpen(false); setInviteError(null); }}><X size={18} /></button>
                </div>
                <h3 id="admin-invite-title">Invitar usuario</h3>
                <p className="admin-modal-description">Genera un enlace para que la persona cree su cuenta. Podrás copiarlo al terminar.</p>
                <form className="admin-invite-form" noValidate onSubmit={(event) => void onInvite(event)}>
                  <label>Correo electrónico
                    <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nombre@empresa.cl" autoComplete="email" autoFocus required />
                  </label>
                  <label>Rol de acceso
                    <select value={selectedRole} onChange={(event) => setSelectedRole(event.target.value as AdminRole["id"])}>
                      {roles.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}
                    </select>
                  </label>
                  {inviteError && (
                    <div className="admin-inline-error" role="alert">
                      {inviteError.startsWith("El correo no parece válido")
                        ? <>El correo no parece válido. Revisa que esté bien escrito, por ejemplo <a href="mailto:nombre@empresa.cl">nombre@empresa.cl</a>.</>
                        : inviteError}
                    </div>
                  )}
                  {duplicatePendingId !== null && (
                    <button className="admin-text-button" type="button" disabled={busy} onClick={() => void onRenew(duplicatePendingId)}>
                      <Link2 size={15} /> Crear otro enlace para esta invitación
                    </button>
                  )}
                  <div className="admin-modal-actions">
                    <button className="admin-secondary-button" type="button" onClick={() => { setInviteOpen(false); setInviteError(null); }}>Cancelar</button>
                    <button className="admin-primary-button" type="submit" disabled={busy}>Crear invitación</button>
                  </div>
                </form>
              </div>
            </div>
          )}
          <div className="admin-summary-row">
            <article className="admin-summary">
              <span>Usuarios</span>
              <strong>{users.length + pending.length}</strong>
            </article>
            <article className="admin-summary">
              <span>Admins</span>
              <strong>
                {users.filter((user) => user.role === "general_admin").length}
              </strong>
            </article>
            <article className="admin-summary">
              <span>Activos hoy</span>
              <strong>{activeUsersToday}</strong>
            </article>
          </div>

          {errorMessage ? <div className="admin-inline-error" role="alert">{errorMessage}</div> : null}
          {notice ? <div className="admin-inline-notice" role="status">{notice}</div> : null}

          {generated && (
            <div className="admin-modal-backdrop">
              <div className="admin-modal admin-link-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-link-title">
                <div className="admin-modal-heading">
                  <span className="admin-modal-icon" aria-hidden="true"><Link2 size={20} /></span>
                  <button className="admin-icon-button" type="button" aria-label="Cerrar enlace" onClick={() => setGenerated(null)}><X size={18} /></button>
                </div>
                <h3 id="admin-link-title">{generated.kind === "invitation" ? "Invitación creada" : "Enlace creado"}</h3>
                <p className="admin-modal-description">Copia el mensaje y compártelo con {generated.link.email}. El enlace vence el {formatChileDate(generated.link.expiresAt, true)}.</p>
                <label className="admin-link-field">Enlace
                  <input readOnly value={registrationUrl(generated.link.token)} onFocus={(event) => event.target.select()} />
                </label>
                {copyStatus === "error" && <div className="admin-inline-error" role="alert">No fue posible copiar el mensaje.</div>}
                <div className="admin-modal-actions">
                  <button className="admin-secondary-button" type="button" onClick={() => setGenerated(null)}>Cerrar</button>
                  <button className="admin-primary-button" type="button" onClick={() => void navigator.clipboard.writeText(
                    generated.kind === "invitation"
                      ? invitationMessage(generated.link)
                      : resetMessage(generated.link),
                  ).then(() => setCopyStatus("copied")).catch(() => setCopyStatus("error"))}>
                    <Copy size={15} /> {copyStatus === "copied" ? "Copiado" : "Copiar mensaje"}
                  </button>
                </div>
                {generated.kind === "invitation" && (
                  <p className="admin-link-warning">Envía este enlace solo a {generated.link.email}. Cualquiera que lo abra podrá crear la cuenta.</p>
                )}
              </div>
            </div>
          )}

          <Panel className="admin-users-panel" title="Usuarios" subtitle="Roles e invitaciones"
            actions={canInvite && (
              <button className="admin-primary-button" type="button" onClick={() => { setInviteError(null); setDuplicatePendingId(null); setInviteOpen(true); }}>
                <MailPlus size={16} /> Invitar usuario
              </button>
            )}>
            <div className="admin-users-table-wrap">
              <table className="admin-users-table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Último acceso</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.uid}
                      className={user.uid === currentUserUid ? "is-current-user" : ""}
                    >
                      <td>
                        <div className="admin-user-cell">
                          <span className="user-avatar" aria-hidden="true">
                            <UserRound size={19} />
                          </span>
                          <div>
                            <strong>{user.displayName || user.email || "Sin nombre"}</strong>
                            <span>{user.email ?? "Sin email"}</span>
                          </div>
                        </div>
                      </td>
                      <td className="admin-last-sign-in">
                        {formatLastSignIn(user.lastSignInAt)}
                      </td>
                      <td>
                        <div className="admin-role-control">
                          <select
                            aria-label={`Rol de ${user.email ?? user.uid}`}
                            value={user.role}
                            disabled={savingUid === user.uid || user.uid === currentUserUid}
                            onChange={(event) =>
                              void handleRoleChange(
                                user.uid,
                                event.target.value as AdminRole["id"],
                              )
                            }
                          >
                            {roles.map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.label}
                              </option>
                            ))}
                          </select>
                          {savingUid === user.uid ? (
                            <span className="admin-saving">
                              <Save size={13} />
                              Guardando
                            </span>
                          ) : null}
                          {user.uid === currentUserUid ? (
                            <span className="admin-current-user">Tu cuenta</span>
                          ) : null}
                        </div>
                      </td>
                      <td><span className="admin-state-badge is-active">Activo</span></td>
                      <td>
                        {canInvite && (
                          <button className="admin-table-action" type="button" disabled={busy} title="Generar enlace para restablecer contraseña" aria-label={`Restablecer contraseña de ${user.email ?? user.uid}`} onClick={() => void onReset(user.uid)}>
                            <KeyRound size={14} /> Restablecer
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {pending.map((invitation) => (
                    <tr key={`pending-${invitation.id}`} className="is-pending">
                      <td>
                        <div className="admin-user-cell">
                          <span className="user-avatar" aria-hidden="true"><UserRound size={19} /></span>
                          <div><strong>{invitation.email}</strong></div>
                        </div>
                      </td>
                      <td>Nunca</td>
                      <td>
                        <select aria-label={`Rol de ${invitation.email}`} value={invitation.role}
                          disabled={!canInvite || busy}
                          onChange={(event) => void onPendingRole(invitation.id, event.target.value as AdminRole["id"])}>
                          {roles.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}
                        </select>
                      </td>
                      <td>
                        <span className={`admin-state-badge ${invitation.expiresAt && Date.parse(invitation.expiresAt) > now ? "is-pending" : "is-expired"}`}>
                          {invitation.expiresAt && Date.parse(invitation.expiresAt) > now
                            ? `Pendiente · vence ${formatChileDate(invitation.expiresAt, false)}`
                            : "Pendiente · enlace vencido"}
                        </span>
                      </td>
                      <td>
                        {canInvite && (
                          <div className="admin-row-actions">
                            <button className="admin-table-action" type="button" disabled={busy} title="Generar un enlace nuevo" aria-label={`Nuevo enlace para ${invitation.email}`} onClick={() => void onRenew(invitation.id)}><Link2 size={14} /> Nuevo enlace</button>
                            <button className="admin-table-action is-danger" type="button" disabled={busy} title="Cancelar invitación" aria-label={`Cancelar invitación de ${invitation.email}`} onClick={() => void onCancel(invitation.id, invitation.email)}><X size={14} /> Cancelar</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel
            title="Permisos por rol"
            subtitle="Acciones disponibles según el rol asignado"
          >
            {permissionRows.length > 0 ? (
              <div className="admin-role-permissions-wrap">
                <div className="admin-role-permissions-legend" aria-label="Leyenda de permisos">
                  <span className="is-included"><Check size={14} aria-hidden="true" /> Disponible</span>
                  <span className="is-unavailable"><span aria-hidden="true">—</span> No disponible</span>
                </div>
                <table className="admin-role-permissions-table">
                  <thead>
                    <tr>
                      <th scope="col">Acción</th>
                      {permissionRoles.map((role) => <th scope="col" key={role.id}>{role.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {permissionRows.map((row) => (
                      <tr key={row.id}>
                        <th scope="row">{row.label}</th>
                        {permissionRoles.map((role) => {
                          const hasPermission = role.permissions.includes(row.id);
                          return (
                            <td key={role.id}>
                              <span
                                className={`admin-role-permission-mark ${hasPermission ? "is-included" : "is-unavailable"}`}
                                role="img"
                                aria-label={hasPermission ? "Disponible" : "No disponible"}
                              >
                                {hasPermission ? <Check size={15} strokeWidth={2.6} aria-hidden="true" /> : "—"}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="admin-role-permissions-empty">No se pudo cargar la configuración de permisos.</p>
            )}
          </Panel>
          <Panel
            title="Uso diario de la aplicación"
            subtitle={`Usuarios únicos con actividad autenticada · ${dailyActivity?.timezone}`}
          >
            <SimpleLineChart
              labelEvery={5}
              maxValue={dailyActivityMax}
              minValue={0}
              series={activitySeries}
              unit="usuarios"
              xAxisLabel="Día"
            />
          </Panel>
        </>
      )}
    </div>
  );
}

const formatLastSignIn = (value: string | null) => {
  if (!value) return "Sin registros";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin registros";
  const dateLabel = new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  })
    .format(date)
    .replace(".", "");
  const timeLabel = new Intl.DateTimeFormat("es-CL", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
  }).format(date);
  return `${dateLabel} · ${timeLabel}`;
};

const formatChileDate = (value: string, includeTime: boolean) => {
  const options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    timeZone: "America/Santiago",
    ...(includeTime ? { hour: "2-digit", hour12: false, minute: "2-digit" } : {}),
  };
  return new Intl.DateTimeFormat("es-CL", options).format(new Date(value)).replace(".", "");
};

const registrationUrl = (token: string) => {
  const url = new URL(import.meta.env.BASE_URL, window.location.origin);
  url.hash = new URLSearchParams({ registro: token }).toString();
  return url.toString();
};

const invitationMessage = (link: GeneratedLink) =>
  `Hola, te invitamos a Agua con Dato, la plataforma de información hídrica de las CAS del Valle de Copiapó. Crea tu cuenta aquí: ${registrationUrl(link.token)}

El enlace es personal, de un solo uso y vence el ${formatChileDate(link.expiresAt, true)}. Si no esperabas esta invitación, ignora este mensaje.`;

const resetMessage = (link: GeneratedLink) =>
  `Hola, aquí puedes crear una nueva contraseña para Agua con Dato: ${registrationUrl(link.token)}. El enlace es personal, de un solo uso y vence el ${formatChileDate(link.expiresAt, true)}.`;
