import { describe, expect, it } from "vitest";
import type { ActSpec, BeatSpec } from "./chapter";
import { hoodRows } from "./hood";

const beat = (id: string, hooks: string[]): BeatSpec => ({
  id,
  rail: id,
  station: "settings",
  shot: "station",
  focus: ["settings"],
  hooks,
});

const act = (beats: BeatSpec[]): ActSpec => ({ id: "boot", kicker: "k", title: "t", beats });

const at = (file: string, line: number) => ({ file, line, url: `https://example.test/${file}#L${line}` });

/* listed in the order the hooks first fired */
const SOURCES = {
  muplugins_loaded: at("wp-settings.php", 548),
  plugins_loaded: at("wp-settings.php", 630),
  init: at("wp-settings.php", 779),
  wp_loaded: at("wp-settings.php", 801),
};

describe("hoodRows", () => {
  it("lists the hooks an act's beats name once each, in the order they fired, with their source", () => {
    const rows = hoodRows(
      act([beat("a", ["wp_loaded"]), beat("b", ["init", "muplugins_loaded"]), beat("c", ["init"])]),
      SOURCES,
    );
    expect(rows).toEqual([
      { name: "muplugins_loaded", ...SOURCES.muplugins_loaded },
      { name: "init", ...SOURCES.init },
      { name: "wp_loaded", ...SOURCES.wp_loaded },
    ]);
  });

  it("is empty for an act that names no hooks", () => {
    expect(hoodRows(act([beat("a", []), beat("b", [])]), SOURCES)).toEqual([]);
  });

  it("throws when a hook has no source, rather than leave it out", () => {
    expect(() => hoodRows(act([beat("a", ["init", "parse_request"])]), SOURCES)).toThrow(
      /boot.*no source.*parse_request/,
    );
  });

  it("does not take a name from the object's prototype for a source", () => {
    expect(() => hoodRows(act([beat("a", ["toString"])]), SOURCES)).toThrow(/toString/);
  });
});
