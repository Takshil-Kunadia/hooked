import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { BeatSpec, ChapterSpec } from "@/lib/story/chapter";
import type { StoryData } from "@/lib/story/facts";
import { Hook } from "./Hook";
import { Story } from "./Story";

/* the 3D stage only renders in a browser; its own tests are visual */
vi.mock("@/components/three/StageMount", () => ({ StageMount: () => null }));

const beat = (id: string, extra: Partial<BeatSpec> = {}): BeatSpec => ({
  id,
  rail: `rail ${id}`,
  station: "init",
  shot: "platform",
  focus: ["init"],
  hooks: [],
  ...extra,
});

const SPEC: ChapterSpec = {
  id: "test",
  acts: [
    { id: "hero", kicker: "", title: "", beats: [beat("start", { station: "browser", shot: "overview" })] },
    {
      id: "boot",
      kicker: "Boarding",
      title: "Off we go",
      beats: [beat("one"), beat("two", { board: "announcements" })],
    },
    { id: "init", kicker: "Stop 4", title: "The bell", beats: [beat("arrive"), beat("announce", { pill: "init" })] },
  ],
};

const COPY = {
  one: (
    <>
      <b>First.</b> Hello <Hook name="init" />.
    </>
  ),
  two: <b>Second.</b>,
  arrive: <b>Third.</b>,
  announce: <b>Fourth.</b>,
};

const DATA: StoryData = {
  version: "7.1",
  wp: "7.1.5",
  request: { method: "GET", path: "/hello-world/" },
  status: 200,
  tickets: { shown: [], hidden: 0, all: [] },
  bootAnnouncements: ["muplugins_loaded"],
  bootActionsFired: 36,
  sources: {},
};

const render = (explainers: unknown = { explainers: [] }): string =>
  renderToStaticMarkup(<Story spec={SPEC} copy={COPY} data={DATA} explainers={explainers} />);

const at = (line: number) => ({
  file: "wp-settings.php",
  line,
  url: `https://github.com/WordPress/WordPress/blob/7.1.5/wp-settings.php#L${line}`,
});

/** The init act names two hooks; the boot act names none. */
const HOOKED: ChapterSpec = {
  ...SPEC,
  acts: SPEC.acts.map((act) =>
    act.id === "init"
      ? { ...act, beats: [beat("arrive", { hooks: ["wp_loaded"] }), beat("announce", { hooks: ["init"] })] }
      : act,
  ),
};
const HOOKED_DATA: StoryData = { ...DATA, sources: { init: at(779), wp_loaded: at(801) } };

describe("Hook", () => {
  it("renders a focusable code word that opens the name's card", () => {
    expect(renderToStaticMarkup(<Hook name="init" />)).toBe('<code data-card="init" tabindex="0">init</code>');
  });
});

describe("Story", () => {
  it("renders every act after the page's hero as a section sized for its beats", () => {
    const html = render();
    expect(html).not.toContain('id="hero"');
    expect(html).toContain(
      '<section id="boot" aria-labelledby="boot-title" class="story-act" style="height:calc(240 * 1svh)"',
    );
    expect(html).toContain('<section id="init"');
  });

  it("follows the hero and every act with a breather", () => {
    expect(render().match(/style="height:40svh"/g)).toHaveLength(3);
  });

  it("lists each act's beats with their copy, the first one active", () => {
    const html = render();
    expect(html).toMatch(
      /<ol data-beats="" class="story-beats"><li data-n="1" data-active="">.*<b>First\.<\/b> Hello <code data-card="init"/,
    );
    /* the words sit in a wrapper, which short windows clamp to one line for the inactive beats */
    expect(html).toContain('<li data-n="2"><div class="story-beat-text"><b>Second.</b></div></li></ol>');
    expect(html).toContain('<h2 id="boot-title">Off we go</h2>');
  });

  it("puts every beat on the rail, the first one current", () => {
    const html = render();
    expect(html).toContain('<nav aria-label="Story steps"');
    expect(html.match(/<button type="button"/g)).toHaveLength(5);
    expect(html).toContain('<button type="button" aria-current="step"><i></i><span>rail start</span></button>');
  });

  it("gives a beat's copy the story data when the copy needs it", () => {
    const copy = { ...COPY, two: (d: StoryData) => <b>Asks for {d.request.path}</b> };
    const html = renderToStaticMarkup(<Story spec={SPEC} copy={copy} data={DATA} explainers={{ explainers: [] }} />);
    expect(html).toContain('<li data-n="2"><div class="story-beat-text"><b>Asks for /hello-world/</b></div></li>');
  });

  it("ends an act that names hooks with an 'Under the hood' list, in fired order, linked to the source", () => {
    const html = renderToStaticMarkup(
      <Story spec={HOOKED} copy={COPY} data={HOOKED_DATA} explainers={{ explainers: [] }} />,
    );
    const init = html.slice(html.indexOf('<section id="init"'));
    expect(init).toMatch(/<\/ol><details class="story-hood"><summary>Under the hood<\/summary>/);
    expect(init.indexOf('data-card="init"', init.indexOf("<details"))).toBeLessThan(
      init.indexOf('data-card="wp_loaded"'),
    );
    expect(init).toContain(
      '<a href="https://github.com/WordPress/WordPress/blob/7.1.5/wp-settings.php#L779" target="_blank" ' +
        'rel="noopener noreferrer">wp-settings.php:779<span class="sr-only"> (opens in a new tab)</span></a>',
    );
    const boot = html.slice(html.indexOf('<section id="boot"'), html.indexOf('<section id="init"'));
    expect(boot).not.toContain("<details");
  });

  it("refuses to render a hook it has no source for", () => {
    expect(() =>
      renderToStaticMarkup(<Story spec={HOOKED} copy={COPY} data={DATA} explainers={{ explainers: [] }} />),
    ).toThrow(/no source/);
  });

  it("rejects an invalid explainers file", () => {
    expect(() => render({ explainers: [{ name: "x" }] })).toThrow(/explainers\.json is not valid/);
  });
});
