/**
 * Chapter 1 against the real WordPress data: the spec is valid, every beat has copy, every name a
 * card can show has an explainer, and the copy takes its facts from the data instead of typing them.
 */
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { STATIONS } from "@/lib/metro/route";
import { renderBeatCopy } from "@/lib/story/beat-copy";
import { storyCards } from "@/lib/story/cards";
import { flattenBeats, validateChapter } from "@/lib/story/chapter";
import { getStoryData } from "@/lib/story/data";
import { loadExplainers } from "@/lib/story/explainers";
import { firedOrder, sourceUrl, type StoryData } from "@/lib/story/facts";
import { hoodRows } from "@/lib/story/hood";
import { createHookMatcher } from "@/lib/wp-data/catalog";
import { readCatalog, readIndex, readTrace } from "@/lib/wp-data/files";
import explainersFile from "../../../content/explainers.json";
import { CHAPTER_1_COPY } from "./copy";
import { CHAPTER_1 } from "./spec";

/* data.ts is server-only; the guard package throws outside React's server build */
vi.mock("server-only", () => ({}));

const ROOT = path.resolve(import.meta.dirname, "../../../content/versions");
/** The trace data.ts tells the story from. */
const SCENARIO = "block-single";
/** Depot.tsx's card name. */
const DEPOT_CARD = "database";
/** Every beat of an act shows at once on desktop: about four lines each at 1280×720. */
const BEAT_MAX_CHARS = 230;

const { latest } = await readIndex(ROOT);
const [catalog, trace, data] = await Promise.all([
  readCatalog(ROOT, latest),
  readTrace(ROOT, latest, SCENARIO),
  getStoryData(),
]);
const matchHook = createHookMatcher(catalog.hooks);
const hookExists = (name: string): boolean => matchHook(name) !== undefined;
const explainers = loadExplainers(explainersFile);

/** The chapter's first act is the page's hero, so Story never renders its copy. */
const [heroAct, ...storyActs] = CHAPTER_1.acts;
const storyBeats = storyActs.flatMap((act) => act.beats);

const render = (id: string, d: StoryData = data): string => renderToStaticMarkup(renderBeatCopy(CHAPTER_1_COPY[id], d));
const cardsIn = (html: string): string[] => [...html.matchAll(/data-card="([^"]+)"/g)].map((m) => m[1] ?? "");
/** The text a reader sees: tags dropped, and the five characters React escapes put back. */
const ENTITIES: Readonly<Record<string, string>> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#x27;": "'",
};
const textOf = (html: string): string =>
  html.replace(/<[^>]+>/g, "").replace(/&(?:amp|lt|gt|quot|#x27);/g, (e) => ENTITIES[e] ?? e);

describe("Chapter 1 spec", () => {
  it("is valid against the real 7.1 hook catalog", () => {
    expect(validateChapter(CHAPTER_1, hookExists)).toEqual([]);
  });

  it("follows the outline: acts, beats, stations, shots, boards, pills and cues", () => {
    const outline = flattenBeats(CHAPTER_1).map(({ actId, spec: b }) =>
      [actId, b.id, b.station, b.shot, b.board ?? "-", b.pill ?? "-", b.cue ?? "-"].join(" "),
    );
    expect(outline).toEqual([
      "hero hero browser overview - - -",
      "before address browser station - request -",
      "before server server station - - -",
      "before php php station - - -",
      "before database php depot - - -",
      "before response php web - response -",
      "boot index index station - - -",
      "boot config config station - - -",
      "boot settings settings station - - -",
      "boot feeders settings feeders announcements - -",
      "init arrive init platform - - -",
      "init announce init platform init init announce",
      "init tickets init platform init - cascade",
      "init loaded init platform - - -",
      "main parse query station - - -",
      "main query query station - - -",
      "main depot query depot - - -",
      "main wp query station - - -",
      "template redirect template station - - -",
      "template hierarchy template station - - -",
      "template include template station - - -",
      "render blocks the_title station - - -",
      "render filter the_title station - - -",
      "render content the_title station - - -",
      "render assemble the_title station - - -",
      "back sent response station - response -",
      "back shutdown response station - - -",
      "back again response overview - - -",
    ]);
  });

  it("names the hooks each beat talks about", () => {
    const hooks = Object.fromEntries(flattenBeats(CHAPTER_1).map(({ spec: b }) => [b.id, b.hooks]));
    expect(hooks.feeders).toEqual(data.bootAnnouncements);
    expect([hooks.announce, hooks.tickets, hooks.loaded]).toEqual([["init"], ["init"], ["wp_loaded"]]);
  });

  it("shows only station names in the hero", () => {
    expect(heroAct?.beats[0]?.focus).toEqual(STATIONS.map((s) => s.id));
  });

  it("gives every beat a short rail label", () => {
    for (const { spec: b } of flattenBeats(CHAPTER_1)) expect(b.rail.length, b.id).toBeLessThanOrEqual(24);
  });
});

describe("Chapter 1 copy", () => {
  it("has copy for every beat the story renders, and none for anything else", () => {
    expect(Object.keys(CHAPTER_1_COPY).sort()).toEqual(storyBeats.map((b) => b.id).sort());
  });

  it("opens every beat with a bold lead-in", () => {
    for (const b of storyBeats) expect(render(b.id), b.id).toMatch(/^<b>/);
  });

  it("takes the request and the status from the data, never typing them", () => {
    const fake: StoryData = { ...data, request: { method: "PUT", path: "/zz-not-real/" }, status: 418 };
    const all = storyBeats.map((b) => render(b.id, fake)).join("\n");
    expect(all).toContain("/zz-not-real/");
    expect(all).not.toContain(data.request.path);
  });

  it("types no numbers: lines, priorities and statuses live in the data, boards and Under the hood", () => {
    const fake: StoryData = { ...data, status: 418 };
    for (const b of storyBeats) expect(textOf(render(b.id, fake)).replace("418", ""), b.id).not.toMatch(/\d/);
  });

  it("never names a listener in the prose: the boards and cards show them", () => {
    const callbacks = data.tickets.all.map((t) => t.callback);
    for (const b of storyBeats) {
      const text = textOf(render(b.id));
      expect(
        callbacks.filter((c) => text.includes(c)),
        b.id,
      ).toEqual([]);
    }
  });

  it("tells the boot announcements in the order they fired", () => {
    const named = cardsIn(render("feeders")).filter((name) => data.bootAnnouncements.includes(name));
    expect(named).toEqual(data.bootAnnouncements);
  });

  it("keeps each beat short enough to sit beside the act's others", () => {
    for (const b of storyBeats) expect(textOf(render(b.id)).length, b.id).toBeLessThanOrEqual(BEAT_MAX_CHARS);
  });

  it("only calls something a hook when it is one, and lists it on its beat", () => {
    for (const b of storyBeats) {
      const hookWords = cardsIn(render(b.id)).filter((name) => explainers.get(name)?.kind === "hook");
      for (const name of hookWords) {
        expect(hookExists(name), name).toBe(true);
        expect(b.hooks, `${b.id} names ${name}`).toContain(name);
      }
    }
  });
});

describe("Under the hood", () => {
  const rowsByAct = Object.fromEntries(storyActs.map((act) => [act.id, hoodRows(act, data.sources)]));

  it("resolves every hook an act names to where core fires it", () => {
    for (const rows of Object.values(rowsByAct)) {
      for (const row of rows) {
        expect(row.url).toBe(sourceUrl(data.wp, row.file, row.line));
        expect(row.line).toBeGreaterThan(0);
      }
    }
  });

  it("lists the boot announcements and init's hooks in the order they fired", () => {
    expect(rowsByAct.boot?.map((r) => r.name)).toEqual(data.bootAnnouncements);
    const initNames = rowsByAct.init?.map((r) => r.name) ?? [];
    expect(initNames).toEqual(["init", "wp_loaded"]);
    expect(initNames).toEqual(firedOrder(trace, initNames));
  });

  it("is left out where no hooks fire yet", () => {
    expect(rowsByAct.before).toEqual([]);
  });

  it("lists the rest of the trip's hooks in the order they fired, ending with shutdown", () => {
    const rest = ["main", "template", "render", "back"].flatMap((id) => rowsByAct[id]?.map((r) => r.name) ?? []);
    expect(rest).toEqual(firedOrder(trace, rest));
    expect(rest.at(-1)).toBe("shutdown");
  });
});

describe("Explainers", () => {
  const hoodNames = storyActs.flatMap((act) => hoodRows(act, data.sources).map((r) => r.name));
  const copyNames = storyBeats.flatMap((b) => cardsIn(render(b.id)));
  const cardNames = new Set([
    ...STATIONS.map((s) => s.card),
    DEPOT_CARD,
    ...data.tickets.shown.map((t) => t.callback),
    ...data.bootAnnouncements,
    ...copyNames,
    ...hoodNames,
  ]);

  it("explain every name a card can show", () => {
    expect([...cardNames].filter((name) => !explainers.has(name))).toEqual([]);
  });

  it("are all used somewhere in the chapter", () => {
    expect([...explainers.keys()].filter((name) => !cardNames.has(name))).toEqual([]);
  });

  it("are one or two sentences", () => {
    for (const e of explainers.values()) {
      const sentences = e.summary.split(/[.!?](?:\s|$)/).filter((s) => s.trim() !== "");
      expect(sentences.length, e.name).toBeLessThanOrEqual(2);
    }
  });

  it("never say only a must-use plugin can hear muplugins_loaded: drop-ins load earlier still", () => {
    const e = explainers.get("muplugins_loaded");
    const text = `${e?.summary ?? ""}\n${e?.example ?? ""}`;
    expect(e?.summary).toMatch(/drop-in/);
    expect(text).not.toMatch(/only (?:a must-use|works from)/i);
  });

  it("link core functions and hooks to the reference, but never the theme's functions or the demo", () => {
    const cards = storyCards(explainers, data.tickets.shown, "init");
    for (const t of data.tickets.shown) {
      const docs = cards[t.callback]?.docs ?? null;
      if (t.origin === "core") expect(docs, t.callback).not.toBeNull();
      else expect(docs, t.callback).toBeNull();
    }
    expect(cards.hooked_demo_init?.demo).toBe(true);
    for (const name of [...data.bootAnnouncements, "init", "wp_loaded"]) expect(cards[name]?.docs, name).toBeTruthy();
  });
});
