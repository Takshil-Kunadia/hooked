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
  sources: {},
};

const render = (explainers: unknown = { explainers: [] }): string =>
  renderToStaticMarkup(<Story spec={SPEC} copy={COPY} data={DATA} explainers={explainers} />);

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
    expect(html).toContain('<li data-n="2"><b>Second.</b></li></ol>');
    expect(html).toContain('<h2 id="boot-title">Off we go</h2>');
  });

  it("puts every beat on the rail, the first one current", () => {
    const html = render();
    expect(html).toContain('<nav aria-label="Story steps"');
    expect(html.match(/<button type="button"/g)).toHaveLength(5);
    expect(html).toContain('<button type="button" aria-current="step"><i></i><span>rail start</span></button>');
  });

  it("rejects an invalid explainers file", () => {
    expect(() => render({ explainers: [{ name: "x" }] })).toThrow(/explainers\.json is not valid/);
  });
});
