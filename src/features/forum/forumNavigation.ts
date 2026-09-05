export type ForumLocation = {
  threadId: string | null;
  postPage: number;
  listPage: number;
};

const positivePage = (value: string | null) => {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
};

export function readForumLocation(search: string): ForumLocation {
  const params = new URLSearchParams(search);
  const candidate = params.get("forumThread");
  const threadId =
    candidate &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      candidate,
    )
      ? candidate
      : null;
  return {
    threadId,
    postPage: threadId ? positivePage(params.get("forumPage")) : 1,
    listPage: positivePage(params.get("forumListPage")),
  };
}

export function writeForumLocation(href: string, location: ForumLocation): URL {
  const url = new URL(href);
  url.searchParams.set("view", "forum");
  url.searchParams.set("forumListPage", String(location.listPage));
  if (location.threadId) {
    url.searchParams.set("forumThread", location.threadId);
    url.searchParams.set("forumPage", String(location.postPage));
  } else {
    url.searchParams.delete("forumThread");
    url.searchParams.delete("forumPage");
  }
  return url;
}
