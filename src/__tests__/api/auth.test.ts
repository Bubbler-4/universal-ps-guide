import { describe, it, expect } from "vitest";
import { signSession, verifySession, parseCookie, sessionCookieHeader, SESSION_COOKIE, type SessionPayload } from "~/lib/auth";

const SECRET = "test-secret-for-unit-tests";

const PAYLOAD: SessionPayload = {
  firebaseUid: "firebase-uid-abc",
  githubId: "12345",
  email: "alice@example.com",
  name: "Alice",
  image: "https://example.com/avatar.png",
  iat: 1700000000,
};

// --- signSession / verifySession --------------------------------------------

describe("signSession / verifySession", () => {
  it("round-trips: verify returns the original payload", async () => {
    const token = await signSession(PAYLOAD, SECRET);
    const result = await verifySession(token, SECRET);
    expect(result).toEqual(PAYLOAD);
  });

  it("returns null when the token is empty", async () => {
    expect(await verifySession("", SECRET)).toBeNull();
  });

  it("returns null when the token has no dot separator", async () => {
    expect(await verifySession("nodot", SECRET)).toBeNull();
  });

  it("returns null when the signature is wrong", async () => {
    const token = await signSession(PAYLOAD, SECRET);
    const [data] = token.split(".");
    const tampered = `${data}.invalidsignature`;
    expect(await verifySession(tampered, SECRET)).toBeNull();
  });

  it("returns null when the data is tampered", async () => {
    const token = await signSession(PAYLOAD, SECRET);
    const parts = token.split(".");
    // Replace the data portion with a different payload
    const fakeData = btoa(JSON.stringify({ ...PAYLOAD, githubId: "99999" }))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    const tampered = `${fakeData}.${parts[parts.length - 1]}`;
    expect(await verifySession(tampered, SECRET)).toBeNull();
  });

  it("returns null when the secret is different", async () => {
    const token = await signSession(PAYLOAD, SECRET);
    expect(await verifySession(token, "different-secret")).toBeNull();
  });

  it("returns null when the data portion is not valid JSON", async () => {
    // Forge a token signed with the correct key but invalid JSON in data.
    const { createHmac } = await import("crypto");
    const data = Buffer.from("not-json").toString("base64url");
    const sig = createHmac("sha256", SECRET).update(data).digest("base64url");
    expect(await verifySession(`${data}.${sig}`, SECRET)).toBeNull();
  });
});

// --- parseCookie ------------------------------------------------------------

describe("parseCookie", () => {
  it("parses a single cookie", () => {
    expect(parseCookie("session=abc123", "session")).toBe("abc123");
  });

  it("parses the correct cookie from multiple cookies", () => {
    expect(parseCookie("foo=bar; session=tok; baz=qux", "session")).toBe("tok");
  });

  it("returns null when the cookie is not present", () => {
    expect(parseCookie("foo=bar; baz=qux", "session")).toBeNull();
  });

  it("returns null for an empty header", () => {
    expect(parseCookie("", "session")).toBeNull();
  });

  it("handles cookie values that contain '='", () => {
    expect(parseCookie("session=abc=def==", "session")).toBe("abc=def==");
  });
});

// --- sessionCookieHeader ----------------------------------------------------

describe("sessionCookieHeader", () => {
  it("contains the session cookie name and value", async () => {
    const token = await signSession(PAYLOAD, SECRET);
    const header = sessionCookieHeader(token);
    expect(header).toContain(`${SESSION_COOKIE}=${token}`);
  });

  it("sets HttpOnly and SameSite=Lax", async () => {
    const token = await signSession(PAYLOAD, SECRET);
    const header = sessionCookieHeader(token);
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Lax");
  });

  it("respects the maxAge parameter", async () => {
    const token = await signSession(PAYLOAD, SECRET);
    const header = sessionCookieHeader(token, 0);
    expect(header).toContain("Max-Age=0");
  });
});
