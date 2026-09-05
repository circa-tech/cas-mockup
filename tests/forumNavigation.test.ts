import assert from "node:assert/strict";
import { test } from "node:test";
import {
  readForumLocation,
  writeForumLocation,
} from "../src/features/forum/forumNavigation.ts";

const threadId = "b22f6858-e52a-4b33-91c7-8f0caf878682";

test("reload preserves a published reply's thread, page and previous list page", () => {
  const location = { threadId, postPage: 2, listPage: 3 };
  const url = writeForumLocation(
    "http://localhost/cas-mockup/?qaUser=alice#content",
    location,
  );
  assert.deepEqual(readForumLocation(url.search), location);
  assert.equal(url.searchParams.get("view"), "forum");
  assert.equal(url.searchParams.get("qaUser"), "alice");
  assert.equal(url.hash, "#content");
});

test("returning to the list removes stale thread and post page", () => {
  const detail = writeForumLocation("http://localhost/", {
    threadId,
    postPage: 2,
    listPage: 3,
  });
  const list = writeForumLocation(detail.href, {
    threadId: null,
    postPage: 2,
    listPage: 3,
  });
  assert.deepEqual(readForumLocation(list.search), {
    threadId: null,
    postPage: 1,
    listPage: 3,
  });
  assert.equal(list.searchParams.has("forumThread"), false);
  assert.equal(list.searchParams.has("forumPage"), false);
});

test("malformed navigation values fall back to valid pages", () => {
  for (const page of [
    "-1",
    "0",
    "1.5",
    "NaN",
    "Infinity",
    "9007199254740992",
  ]) {
    assert.equal(
      readForumLocation(`?forumThread=${threadId}&forumPage=${page}`).postPage,
      1,
    );
  }
  assert.deepEqual(
    readForumLocation("?forumThread=invalid&forumPage=2&forumListPage=-1"),
    { threadId: null, postPage: 1, listPage: 1 },
  );
});
