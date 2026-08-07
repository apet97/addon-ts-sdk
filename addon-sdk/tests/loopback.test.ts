import { describe, expect, it } from "vitest";
import { isCanonicalLoopbackHostname, isHttpsOrLoopbackHttp } from "../src/shared/loopback";

describe("isCanonicalLoopbackHostname", () => {
  it("recognizes localhost and IPv4 loopback", () => {
    expect(isCanonicalLoopbackHostname("localhost")).toBe(true);
    expect(isCanonicalLoopbackHostname("127.0.0.1")).toBe(true);
  });

  it("recognizes IPv6 loopback whether or not the caller kept the brackets", () => {
    // Node's WHATWG URL keeps the brackets in `.hostname` ("[::1]"), but some
    // runtimes (browsers, workerd) may report it unbracketed ("::1") — both
    // forms must be treated as the same canonical loopback host.
    expect(isCanonicalLoopbackHostname("[::1]")).toBe(true);
    expect(isCanonicalLoopbackHostname("::1")).toBe(true);
  });

  it("rejects non-canonical loopback spellings", () => {
    expect(isCanonicalLoopbackHostname("127.1")).toBe(false);
    expect(isCanonicalLoopbackHostname("0x7f000001")).toBe(false);
    expect(isCanonicalLoopbackHostname("2130706433")).toBe(false);
    expect(isCanonicalLoopbackHostname("LOCALHOST")).toBe(false);
  });
});

describe("isHttpsOrLoopbackHttp", () => {
  it("accepts HTTPS for any host", () => {
    expect(isHttpsOrLoopbackHttp(new URL("https://api.example/api"))).toBe(true);
  });

  it("accepts HTTP only on canonical loopback, bracketed or not", () => {
    expect(isHttpsOrLoopbackHttp(new URL("http://[::1]:8080/api"))).toBe(true);
    expect(isHttpsOrLoopbackHttp(new URL("http://127.0.0.1:8080/api"))).toBe(true);
    expect(isHttpsOrLoopbackHttp(new URL("http://api.example/api"))).toBe(false);
  });
});
