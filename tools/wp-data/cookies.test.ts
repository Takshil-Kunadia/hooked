import { describe, expect, it } from "vitest";
import { keepCookies } from "./cookies";

describe("keepCookies", () => {
  it("stores new cookies and forgets the ones a response expires", () => {
    const jar = new Map([
      ["wordpress_logged_in_abc", "old"],
      ["wp-settings-1", "x"],
    ]);
    keepCookies(jar, [
      "wordpress_test_cookie=WP%20Cookie%20check; path=/; HttpOnly",
      "wordpress_logged_in_abc=%20; expires=Wed, 19 Nov 2025 05:21:58 GMT; Max-Age=0; path=/",
      "wp-settings-1=deleted; path=/",
      "malformed",
    ]);
    expect([...jar]).toEqual([["wordpress_test_cookie", "WP%20Cookie%20check"]]);
  });
});
