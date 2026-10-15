import test from "node:test";
import assert from "node:assert/strict";
import { api, post, patch, remove, ApiError } from "../src/api.ts";

test("requests retain session cookies and parse successful data", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "/api/services");
    assert.equal(options.credentials, "include");
    return Response.json([{ id: "test" }]);
  });
  assert.deepEqual(await api("/services"), [{ id: "test" }]);
});
test("auth failure retains status for session recovery", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json(
      { detail: "Session expired. Sign in again." },
      { status: 401 },
    ),
  );
  await assert.rejects(
    api("/auth/me"),
    (e) =>
      e instanceof ApiError &&
      e.status === 401 &&
      e.message.includes("Sign in"),
  );
});
test("server validation details become readable field errors", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json(
      { detail: [{ msg: "URL must use HTTPS" }, { msg: "Name is required" }] },
      { status: 422 },
    ),
  );
  await assert.rejects(api("/services"), {
    message: "URL must use HTTPS. Name is required",
  });
});
test("HTML gateway errors do not crash JSON parsing or expose server HTML", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("<html>bad gateway</html>", { status: 502 }),
  );
  await assert.rejects(
    api("/services"),
    (e) =>
      e.status === 502 &&
      e.message === "Something went wrong. Please try again.",
  );
});
test("create encodes JSON and preserves server response", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(options.method, "POST");
    assert.equal(options.body, '{"title":"Handle <unsafe> input"}');
    return Response.json({ id: "new" });
  });
  assert.deepEqual(await post("/tasks", { title: "Handle <unsafe> input" }), {
    id: "new",
  });
});
test("edit sends only intended fields", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(options.method, "PATCH");
    assert.deepEqual(JSON.parse(options.body), { status: "done" });
    return Response.json({ status: "done" });
  });
  assert.equal((await patch("/tasks/id", { status: "done" })).status, "done");
});
test("deletion uses authenticated DELETE", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(options.method, "DELETE");
    assert.equal(options.credentials, "include");
    return Response.json({ ok: true });
  });
  assert.equal((await remove("/tasks/id")).ok, true);
});
