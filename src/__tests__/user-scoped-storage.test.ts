/**
 * Shared-device isolation.
 *
 * A school tablet gets passed round. When "Continue where you left off" and the
 * assistant's transcript lived in global localStorage keys, signing out and
 * signing in as somebody else handed them the previous person's state. These
 * tests pin the two mechanisms that stop it: namespacing by auth user id, and
 * a sweep on sign-out.
 */

import { clearUserScopedStorage, readUserScoped, userScopedKey, writeUserScoped } from "@/lib/user-scoped-storage";

const STORAGE_KEY = "skoolmate_owly_messages_v1";

describe("userScopedKey", () => {
  beforeEach(() => localStorage.clear());

  it("namespaces by user id so two users never share a key", () => {
    expect(userScopedKey("k", "user-a")).not.toBe(userScopedKey("k", "user-b"));
  });

  it("never falls back to the bare key when the user is unknown", () => {
    // An unresolved user must not read a shared bucket. A distinct name means
    // "scratch", not "everybody's".
    expect(userScopedKey("k", null)).not.toBe("k");
    expect(userScopedKey("k", undefined)).not.toBe("k");
  });

  it("does not collide across similar ids", () => {
    expect(userScopedKey("k", "ab")).not.toBe(userScopedKey("k", "a::b"));
  });
});

describe("readUserScoped / writeUserScoped", () => {
  beforeEach(() => localStorage.clear());

  it("keeps each user's data to themselves", () => {
    writeUserScoped(STORAGE_KEY, "headmaster", [{ text: "salaries for March" }]);
    writeUserScoped(STORAGE_KEY, "pupil", [{ text: "my exam mark" }]);

    expect(readUserScoped(STORAGE_KEY, "headmaster")).toEqual([{ text: "salaries for March" }]);
    expect(readUserScoped(STORAGE_KEY, "pupil")).toEqual([{ text: "my exam mark" }]);
  });

  it("discards pre-scoping leftovers rather than adopting them", () => {
    // Written by a build from before namespacing existed. Whose it was is
    // unknowable, so it must be dropped, not inherited by whoever signs in next.
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ text: "someone else's business" }]));

    expect(readUserScoped(STORAGE_KEY, "new-user")).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("survives garbage already in storage", () => {
    localStorage.setItem(userScopedKey(STORAGE_KEY, "user-a"), "{not json");
    expect(readUserScoped(STORAGE_KEY, "user-a")).toBeNull();
  });
});

describe("clearUserScopedStorage", () => {
  beforeEach(() => localStorage.clear());

  it("removes every user's namespaces on sign-out", () => {
    writeUserScoped("skoolmate_recent_pages", "user-a", [{ href: "/dashboard/fees" }]);
    writeUserScoped("skoolmate_owly_messages_v1", "user-b", [{ text: "private" }]);

    clearUserScopedStorage();

    expect(localStorage.length).toBe(0);
  });

  it("clears namespaces left by earlier sessions, not just known ids", () => {
    // Written before this module existed the key still carries the separator,
    // so the sweep must reach it without an id list.
    localStorage.setItem("skoolmate_recent_pages::user-from-last-term", "[]");
    clearUserScopedStorage();
    expect(localStorage.getItem("skoolmate_recent_pages::user-from-last-term")).toBeNull();
  });

  it("leaves unrelated keys alone", () => {
    localStorage.setItem("academic_year", "2026");
    localStorage.setItem("skoolmate_recent_pages::u", "[]");

    clearUserScopedStorage();

    expect(localStorage.getItem("academic_year")).toBe("2026");
    expect(localStorage.getItem("skoolmate_recent_pages::u")).toBeNull();
  });
});
