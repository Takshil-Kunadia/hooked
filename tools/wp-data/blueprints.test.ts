import { describe, expect, it } from "vitest";
import { blueprintFor } from "./blueprints";
import { SITES } from "./config";

const VERSIONS = { wp: "7.0.9", php: "8.3" } as const;

const stepsOf = (blueprint: Readonly<Record<string, unknown>>): Array<Record<string, unknown>> =>
  blueprint.steps as Array<Record<string, unknown>>;

describe("blueprintFor", () => {
  it("pins the exact WordPress and PHP versions in the blueprint itself", () => {
    expect(blueprintFor(SITES.block, VERSIONS)).toMatchObject({ preferredVersions: { wp: "7.0.9", php: "8.3" } });
  });

  it("only the classic site switches theme, and nothing downloads during setup", () => {
    const names = (site: keyof typeof SITES): unknown[] =>
      stepsOf(blueprintFor(SITES[site], VERSIONS)).map((s) => s.step);
    expect(names("block")).not.toContain("activateTheme");
    expect(names("classic")).toContain("activateTheme");
    for (const site of Object.keys(SITES) as Array<keyof typeof SITES>)
      expect(names(site)).not.toContain("installTheme");
  });

  it("only the admin site mints auth cookies", () => {
    const code = (site: keyof typeof SITES): string =>
      stepsOf(blueprintFor(SITES[site], VERSIONS))
        .map((s) => String(s.code ?? ""))
        .join("\n");
    expect(code("admin")).toContain("wp_generate_auth_cookie");
    expect(code("block")).not.toContain("wp_generate_auth_cookie");
  });

  it("every site replaces Playground's well-known admin password", () => {
    for (const spec of Object.values(SITES)) {
      const code = stepsOf(blueprintFor(spec, VERSIONS))
        .map((s) => String(s.code ?? ""))
        .join("\n");
      expect(code).toContain("wp_set_password( wp_generate_password(");
    }
  });

  it("every site gets pretty permalinks, the demo plugin and the repeatability constants", () => {
    for (const spec of Object.values(SITES)) {
      const steps = stepsOf(blueprintFor(spec, VERSIONS));
      expect(steps[0]).toMatchObject({ consts: { WP_CACHE: true, DISABLE_WP_CRON: true } });
      expect(steps).toContainEqual({ step: "activatePlugin", pluginPath: "hooked-demo/hooked-demo.php" });
      expect(steps.some((s) => String(s.code ?? "").includes("set_permalink_structure( '/%postname%/' )"))).toBe(true);
    }
  });
});
