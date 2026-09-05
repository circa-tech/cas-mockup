export type ForumPage<T> = {
  items: T[];
  page: number;
  page_size: number;
  total: number;
};
export type ForumThread = {
  id: string;
  title: string;
  author_name: string;
  created_at: string;
  updated_at: string | null;
  last_activity_at: string;
  reply_count: number;
  can_edit: boolean;
  can_delete: boolean;
};
export type ForumQuote = {
  id: string;
  author_name: string;
  body: string | null;
  deleted_at: string | null;
};
export type ForumPost = {
  id: string;
  thread_id: string;
  author_name: string;
  body: string | null;
  is_initial: boolean;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  quote: ForumQuote | null;
  likes: number;
  dislikes: number;
  my_reaction: "like" | "dislike" | null;
  can_edit: boolean;
  can_delete: boolean;
};
export class ForumApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
export async function requestForum<T>(
  token: string,
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  if (!baseUrl) throw new Error("No se ha configurado la conexión al foro.");
  const response = await fetch(`${baseUrl}/api/v1/forum/${path}`, {
    method,
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    let message = "No se pudo completar la solicitud. Inténtalo de nuevo.";
    if (response.status === 401)
      message = "Tu sesión expiró. Vuelve a iniciar sesión.";
    else if (response.status === 403)
      message = "No tienes permiso para realizar esta acción.";
    else if (response.status === 404)
      message = "Este tema o publicación ya no está disponible.";
    else if (response.status === 422)
      message = "Revisa el texto y la publicación que estás citando.";
    throw new ForumApiError(response.status, message);
  }
  return response.status === 204
    ? (undefined as T)
    : (response.json() as Promise<T>);
}
