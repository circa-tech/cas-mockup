import { useConfirmationDialog } from "../../components/useConfirmationDialog";
import { readForumLocation, writeForumLocation } from "./forumNavigation";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  MessageSquare,
  Pencil,
  Plus,
  Quote,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { Panel } from "../../components/Panel";
import { queryKeys } from "../../lib/queryKeys";
import {
  ForumApiError,
  requestForum,
  type ForumPage,
  type ForumPost,
  type ForumQuote,
  type ForumThread,
} from "../../services/forumApi";

const PAGE_SIZE = 20;
const date = (value: string) =>
  new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Santiago",
  }).format(new Date(value));

function Pagination({
  page,
  total,
  onChange,
  disabled,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
  disabled?: boolean;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const numbers = [...new Set([1, page - 1, page, page + 1, pages])]
    .filter((n) => n >= 1 && n <= pages)
    .sort((a, b) => a - b);
  return (
    <nav className="forum-pagination" aria-label="Paginación del foro">
      <span>
        Página {page} de {pages} · {total}{" "}
        {total === 1 ? "registro" : "registros"}
      </span>
      <div>
        <button
          disabled={disabled || page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Anterior
        </button>
        {numbers.map((n, i) => (
          <span key={n}>
            {i > 0 && n - numbers[i - 1] > 1 && (
              <span className="forum-ellipsis">…</span>
            )}
            <button
              disabled={disabled}
              aria-label={`Página ${n}`}
              aria-current={n === page ? "page" : undefined}
              onClick={() => onChange(n)}
            >
              {n}
            </button>
          </span>
        ))}
        <button
          disabled={disabled || page >= pages}
          onClick={() => onChange(page + 1)}
        >
          Siguiente
        </button>
      </div>
    </nav>
  );
}

function QuoteBlock({ quote }: { quote: ForumQuote }) {
  return (
    <blockquote className="forum-quote">
      <strong>{quote.author_name} escribió:</strong>
      <p>{quote.deleted_at ? "Publicación eliminada" : quote.body}</p>
    </blockquote>
  );
}

function ErrorState({ error, retry }: { error: Error; retry?: () => void }) {
  return (
    <div className="forum-error" role="alert">
      <span>{error.message}</span>
      {retry && <button onClick={retry}>Reintentar</button>}
    </div>
  );
}

type Props = {
  authIdToken: string | null;
  authUid: string | null;
  onLogin: () => void;
};
export function ForumView(props: Props) {
  if (!props.authIdToken || !props.authUid)
    return (
      <Panel
        title="Foro"
        subtitle="Un espacio para conversar sobre el agua y los datos ambientales."
      >
        <div className="forum-empty">
          <MessageSquare size={28} />
          <p>Inicia sesión para leer y participar en el foro.</p>
          <button className="forum-primary" onClick={props.onLogin}>
            Iniciar sesión
          </button>
        </div>
      </Panel>
    );
  return <AuthenticatedForum key={props.authUid} token={props.authIdToken} />;
}

function AuthenticatedForum({ token }: { token: string }) {
  const client = useQueryClient();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const [initialLocation] = useState(() =>
    readForumLocation(window.location.search),
  );
  const [listPage, setListPage] = useState(initialLocation.listPage);
  const [threadId, setThreadId] = useState<string | null>(
    initialLocation.threadId,
  );
  const [postPage, setPostPage] = useState(initialLocation.postPage);
  const [publishedPostId, setPublishedPostId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    const url = writeForumLocation(window.location.href, {
      threadId,
      postPage,
      listPage,
    });
    window.history.replaceState(window.history.state, "", url);
  }, [threadId, postPage, listPage]);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState("");
  const [quote, setQuote] = useState<ForumQuote | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [nextTitle, setNextTitle] = useState("");
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [editedBody, setEditedBody] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  const [error, setError] = useState<Error | null>(null);
  const replyInput = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const threads = useQuery({
    queryKey: queryKeys.forum.threads(token, listPage),
    enabled: !threadId,
    queryFn: ({ signal }) =>
      requestForum<ForumPage<ForumThread>>(
        token,
        `threads?page=${listPage}&page_size=${PAGE_SIZE}`,
        "GET",
        undefined,
        signal,
      ),
    staleTime: 0,
  });
  const thread = useQuery({
    queryKey: queryKeys.forum.thread(token, threadId),
    enabled: Boolean(threadId),
    queryFn: ({ signal }) =>
      requestForum<ForumThread>(
        token,
        `threads/${threadId}`,
        "GET",
        undefined,
        signal,
      ),
    staleTime: 0,
  });
  const posts = useQuery({
    queryKey: queryKeys.forum.posts(token, threadId, postPage),
    enabled: Boolean(threadId),
    queryFn: ({ signal }) =>
      requestForum<ForumPage<ForumPost>>(
        token,
        `threads/${threadId}/posts?page=${postPage}&page_size=${PAGE_SIZE}`,
        "GET",
        undefined,
        signal,
      ),
    staleTime: 0,
  });
  useEffect(() => {
    if (threads.data)
      setListPage((p) =>
        Math.min(p, Math.max(1, Math.ceil(threads.data.total / PAGE_SIZE))),
      );
  }, [threads.data]);
  useEffect(() => {
    if (posts.data)
      setPostPage((p) =>
        Math.min(p, Math.max(1, Math.ceil(posts.data.total / PAGE_SIZE))),
      );
  }, [posts.data]);
  useEffect(() => {
    if (
      !publishedPostId ||
      !posts.data?.items.some((post) => post.id === publishedPostId)
    )
      return;
    const element = document.getElementById(`post-${publishedPostId}`);
    if (element) {
      element.scrollIntoView({ block: "center" });
      element.focus({ preventScroll: true });
      setPublishedPostId(null);
    }
  }, [posts.data, publishedPostId]);
  const run = async (action: () => Promise<unknown>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      if (mounted.current)
        await client.invalidateQueries({
          queryKey: queryKeys.forum.root(token),
        });
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error ? e : new Error("No se pudo guardar el cambio."),
        );
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const resetDetail = () => {
    setNotice(null);
    setPublishedPostId(null);
    setReply("");
    setQuote(null);
    setEditingPost(null);
    setEditingTitle(false);
    setError(null);
  };
  const openThread = (id: string) => {
    resetDetail();
    setThreadId(id);
    setPostPage(1);
    setCreating(false);
  };
  const back = async () => {
    if (
      (reply.trim() || editingPost || editingTitle) &&
      !(await confirm({
        title: "¿Descartar los cambios?",
        description:
          "Tienes cambios sin guardar. Si vuelves a los temas, se perderán.",
        confirmLabel: "Descartar y volver",
      }))
    )
      return;
    resetDetail();
    setThreadId(null);
  };
  const changePostPage = async (page: number) => {
    if (
      editingPost &&
      !(await confirm({
        title: "¿Descartar la edición?",
        description: "Si cambias de página, se perderá la edición sin guardar.",
        confirmLabel: "Descartar y continuar",
      }))
    )
      return;
    setEditingPost(null);
    setPostPage(page);
  };
  const refresh = () => {
    void thread.refetch();
    void posts.refetch();
  };
  return (
    <div className="view-stack forum-view">
      {confirmationDialog}
      <div className="view-intro">
        <h2>Foro</h2>
        <p>
          Comparte preguntas y experiencias sobre el agua y los datos
          ambientales.
        </p>
      </div>
      {error && <ErrorState error={error} />}
      {notice && (
        <p className="forum-notice" role="status">
          {notice}
        </p>
      )}
      {busy && (
        <span className="forum-saving" role="status">
          Guardando cambios…
        </span>
      )}
      {!threadId ? (
        <Panel title="Temas de conversación">
          <div className="forum-toolbar">
            <span>Conversaciones más recientes</span>
            <button
              className="forum-primary"
              disabled={busy}
              onClick={() => setCreating(!creating)}
            >
              <Plus size={15} />
              Nuevo tema
            </button>
          </div>
          {creating && (
            <form
              className="forum-form"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const created = await requestForum<ForumThread>(
                    token,
                    "threads",
                    "POST",
                    { title, body },
                  );
                  if (!mounted.current) return;
                  setTitle("");
                  setBody("");
                  openThread(created.id);
                });
              }}
            >
              <div className="forum-field">
                <label htmlFor="forum-new-title">Título</label>
                <input
                  id="forum-new-title"
                  required
                  maxLength={200}
                  value={title}
                  disabled={busy}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="forum-field">
                <label htmlFor="forum-new-body">Mensaje</label>
                <textarea
                  id="forum-new-body"
                  required
                  maxLength={10000}
                  rows={5}
                  value={body}
                  disabled={busy}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>
              <div className="forum-actions">
                <button
                  className="forum-primary"
                  disabled={busy || !title.trim() || !body.trim()}
                >
                  Publicar tema
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setCreating(false)}
                >
                  Cerrar formulario
                </button>
              </div>
            </form>
          )}
          {threads.isPending && <p role="status">Cargando temas…</p>}
          {threads.error && (
            <ErrorState
              error={threads.error}
              retry={() => {
                void threads.refetch();
              }}
            />
          )}
          {threads.data && (
            <>
              {threads.data.total === 0 ? (
                <div className="forum-empty">
                  <MessageSquare size={28} />
                  <p>Aún no hay temas. Inicia la primera conversación.</p>
                </div>
              ) : (
                <table className="forum-table">
                  <thead>
                    <tr>
                      <th>Tema</th>
                      <th>Autor</th>
                      <th>Respuestas</th>
                      <th>Última actividad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {threads.data.items.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <button
                            className="forum-thread-link"
                            disabled={busy}
                            onClick={() => openThread(t.id)}
                          >
                            {t.title}
                          </button>
                        </td>
                        <td data-label="Autor">{t.author_name}</td>
                        <td data-label="Respuestas">{t.reply_count}</td>
                        <td data-label="Última actividad">
                          <time dateTime={t.last_activity_at}>
                            {date(t.last_activity_at)}
                          </time>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <Pagination
                page={listPage}
                total={threads.data.total}
                onChange={setListPage}
                disabled={busy || threads.isFetching}
              />
            </>
          )}
        </Panel>
      ) : (
        <>
          <div>
            <button disabled={busy} onClick={back}>
              <ArrowLeft size={15} />
              Volver a los temas
            </button>
          </div>
          {(thread.isPending || posts.isPending) && (
            <p role="status">Cargando conversación…</p>
          )}
          {(thread.error || posts.error) && (
            <ErrorState
              error={(thread.error || posts.error)!}
              retry={refresh}
            />
          )}
          {thread.data &&
            !(
              thread.error instanceof ForumApiError &&
              thread.error.status === 404
            ) && (
              <Panel
                title={thread.data.title}
                subtitle={`Iniciado por ${thread.data.author_name} · ${date(thread.data.created_at)}`}
              >
                <div className="forum-actions">
                  {thread.data.can_edit && (
                    <button
                      disabled={busy}
                      onClick={() => {
                        setEditingTitle(true);
                        setNextTitle(thread.data.title);
                      }}
                    >
                      <Pencil size={14} />
                      Editar título
                    </button>
                  )}
                  {thread.data.can_delete && (
                    <button
                      className="forum-danger"
                      disabled={busy}
                      onClick={async () => {
                        if (
                          !(await confirm({
                            title: "¿Eliminar este tema?",
                            description:
                              "Se eliminarán todas sus publicaciones, incluidas las respuestas de otras personas. Esta acción no se puede deshacer.",
                            confirmLabel: "Eliminar tema",
                            destructive: true,
                          }))
                        )
                          return;
                        void run(async () => {
                          await requestForum(
                            token,
                            `threads/${threadId}`,
                            "DELETE",
                          );
                          if (mounted.current) {
                            resetDetail();
                            setThreadId(null);
                          }
                        });
                      }}
                    >
                      <Trash2 size={14} />
                      Eliminar tema
                    </button>
                  )}
                </div>
                {editingTitle && (
                  <form
                    className="forum-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run(async () => {
                        await requestForum(
                          token,
                          `threads/${threadId}`,
                          "PATCH",
                          { title: nextTitle },
                        );
                        setEditingTitle(false);
                      });
                    }}
                  >
                    <div className="forum-field">
                      <label htmlFor="forum-edit-title">Título</label>
                      <input
                        id="forum-edit-title"
                        required
                        maxLength={200}
                        value={nextTitle}
                        disabled={busy}
                        onChange={(e) => setNextTitle(e.target.value)}
                      />
                    </div>
                    <div className="forum-actions">
                      <button
                        className="forum-primary"
                        disabled={busy || !nextTitle.trim()}
                      >
                        Guardar título
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setEditingTitle(false)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}
                {posts.data && (
                  <>
                    <Pagination
                      page={postPage}
                      total={posts.data.total}
                      onChange={changePostPage}
                      disabled={busy || posts.isFetching}
                    />
                    <div className="forum-posts">
                      {posts.data.items.map((p) => (
                        <article
                          className="forum-post"
                          key={p.id}
                          id={`post-${p.id}`}
                          tabIndex={-1}
                        >
                          <header>
                            <strong>{p.author_name}</strong>
                            <span>
                              <time dateTime={p.created_at}>
                                {date(p.created_at)}
                              </time>
                              {p.updated_at && !p.deleted_at
                                ? " · Editado"
                                : ""}
                            </span>
                          </header>
                          {p.deleted_at ? (
                            <p className="forum-deleted">
                              Publicación eliminada
                            </p>
                          ) : (
                            <>
                              {p.quote && <QuoteBlock quote={p.quote} />}
                              {editingPost === p.id ? (
                                <form
                                  className="forum-form"
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    void run(async () => {
                                      await requestForum(
                                        token,
                                        `posts/${p.id}`,
                                        "PATCH",
                                        { body: editedBody },
                                      );
                                      setEditingPost(null);
                                    });
                                  }}
                                >
                                  <div className="forum-field">
                                    <label htmlFor="forum-edit-body">
                                      Editar mensaje
                                    </label>
                                    <textarea
                                      id="forum-edit-body"
                                      required
                                      rows={5}
                                      maxLength={10000}
                                      disabled={busy}
                                      value={editedBody}
                                      onChange={(e) =>
                                        setEditedBody(e.target.value)
                                      }
                                    />
                                  </div>
                                  <div className="forum-actions">
                                    <button
                                      className="forum-primary"
                                      disabled={busy || !editedBody.trim()}
                                    >
                                      Guardar cambios
                                    </button>
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => setEditingPost(null)}
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </form>
                              ) : (
                                <p className="forum-body">{p.body}</p>
                              )}
                              <footer className="forum-actions">
                                {(["like", "dislike"] as const).map((value) => (
                                  <button
                                    key={value}
                                    disabled={busy}
                                    aria-pressed={p.my_reaction === value}
                                    aria-label={`${value === "like" ? "Me gusta" : "No me gusta"}: ${value === "like" ? p.likes : p.dislikes}`}
                                    onClick={() => {
                                      void run(() =>
                                        requestForum(
                                          token,
                                          `posts/${p.id}/reaction`,
                                          p.my_reaction === value
                                            ? "DELETE"
                                            : "PUT",
                                          p.my_reaction === value
                                            ? undefined
                                            : { value },
                                        ),
                                      );
                                    }}
                                  >
                                    {value === "like" ? (
                                      <ThumbsUp size={14} />
                                    ) : (
                                      <ThumbsDown size={14} />
                                    )}
                                    {value === "like" ? p.likes : p.dislikes}
                                  </button>
                                ))}
                                <button
                                  disabled={busy}
                                  onClick={() => {
                                    setQuote({
                                      id: p.id,
                                      author_name: p.author_name,
                                      body: p.body,
                                      deleted_at: p.deleted_at,
                                    });
                                    replyInput.current?.focus();
                                  }}
                                >
                                  <Quote size={14} />
                                  Citar
                                </button>
                                {p.can_edit && (
                                  <button
                                    disabled={busy}
                                    onClick={async () => {
                                      if (
                                        editingPost &&
                                        editingPost !== p.id &&
                                        !(await confirm({
                                          title:
                                            "¿Descartar la edición anterior?",
                                          description:
                                            "Los cambios sin guardar se perderán al editar otra publicación.",
                                          confirmLabel: "Descartar y editar",
                                        }))
                                      )
                                        return;
                                      setEditingPost(p.id);
                                      setEditedBody(p.body ?? "");
                                    }}
                                  >
                                    <Pencil size={14} />
                                    Editar
                                  </button>
                                )}
                                {p.can_delete && (
                                  <button
                                    className="forum-danger"
                                    disabled={busy}
                                    onClick={async () => {
                                      if (
                                        !(await confirm({
                                          title: "¿Eliminar esta publicación?",
                                          description:
                                            "Se eliminarán su texto y sus reacciones. Las respuestas se conservarán.",
                                          confirmLabel: "Eliminar publicación",
                                          destructive: true,
                                        }))
                                      )
                                        return;
                                      void run(async () => {
                                        await requestForum(
                                          token,
                                          `posts/${p.id}`,
                                          "DELETE",
                                        );
                                        if (editingPost === p.id)
                                          setEditingPost(null);
                                        if (quote?.id === p.id) setQuote(null);
                                      });
                                    }}
                                  >
                                    <Trash2 size={14} />
                                    Eliminar
                                  </button>
                                )}
                              </footer>
                            </>
                          )}
                        </article>
                      ))}
                    </div>
                    <Pagination
                      page={postPage}
                      total={posts.data.total}
                      onChange={changePostPage}
                      disabled={busy || posts.isFetching}
                    />
                  </>
                )}
                <form
                  className="forum-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      const created = await requestForum<{
                        id: string;
                        position: number;
                      }>(token, `threads/${threadId}/posts`, "POST", {
                        body: reply,
                        quoted_post_id: quote?.id ?? null,
                      });
                      if (!mounted.current) return;
                      setReply("");
                      setQuote(null);
                      setEditingPost(null);
                      const destinationPage = Math.ceil(
                        created.position / PAGE_SIZE,
                      );
                      setPostPage(destinationPage);
                      setPublishedPostId(created.id);
                      setNotice(
                        `Respuesta publicada. Página ${destinationPage}.`,
                      );
                    });
                  }}
                >
                  {quote && (
                    <div>
                      <QuoteBlock quote={quote} />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setQuote(null)}
                      >
                        Quitar cita
                      </button>
                    </div>
                  )}
                  <div className="forum-field">
                    <label htmlFor="forum-reply">Tu respuesta</label>
                    <textarea
                      id="forum-reply"
                      ref={replyInput}
                      required
                      maxLength={10000}
                      rows={5}
                      disabled={busy}
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                    />
                  </div>
                  <div>
                    <button
                      className="forum-primary"
                      disabled={busy || !reply.trim()}
                    >
                      Publicar respuesta
                    </button>
                  </div>
                </form>
              </Panel>
            )}
        </>
      )}
    </div>
  );
}
