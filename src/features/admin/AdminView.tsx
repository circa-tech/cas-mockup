import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, UserRound } from "lucide-react";
import { useState } from "react";
import { Panel } from "../../components/Panel";
import { RemoteDataState } from "../../components/RemoteDataState";
import {
  fetchAdminRoles,
  fetchAdminUsers,
  updateAdminUserRole,
  type AdminRole,
  type AdminUser,
} from "../../services/adminApi";
import { queryKeys } from "../../lib/queryKeys";

type AdminViewProps = {
  authIdToken: string | null;
  currentUserUid: string | null;
};

export function AdminView({ authIdToken, currentUserUid }: AdminViewProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const enabled = Boolean(authIdToken);
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
  const roles = rolesQuery.data ?? [];
  const users = usersQuery.data ?? [];
  const loadStatus = !enabled
    ? "error"
    : rolesQuery.isPending || usersQuery.isPending
      ? "loading"
      : rolesQuery.isError || usersQuery.isError
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
          <div className="admin-summary-row">
            <article className="admin-summary">
              <span>Usuarios</span>
              <strong>{users.length}</strong>
            </article>
            <article className="admin-summary">
              <span>Admins</span>
              <strong>
                {users.filter((user) => user.permissions.includes("users:manage")).length}
              </strong>
            </article>
          </div>

          {errorMessage ? (
            <div className="admin-inline-error" role="alert">
              {errorMessage}
            </div>
          ) : null}

          <Panel title="Usuarios Firebase" subtitle="Cambio directo de rol por usuario">
            <div className="admin-users-table-wrap">
              <table className="admin-users-table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Rol</th>
                    <th>Permisos</th>
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
                          <span className="admin-user-icon">
                            <UserRound size={16} />
                          </span>
                          <div>
                            <strong>{user.displayName || user.email || "Sin nombre"}</strong>
                            <span>{user.email ?? "Sin email"}</span>
                          </div>
                        </div>
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
                      <td>
                        {user.permissions.length > 0 ? (
                          <div className="admin-permission-list">
                            {user.permissions.map((permission) => (
                              <span key={permission}>{permission}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="admin-empty-permissions">Sin permisos admin</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
