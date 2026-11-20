import { describe, expect, it } from "vitest";
import { storyCards } from "./cards";
import type { Explainer } from "./explainers";
import type { Ticket } from "./facts";

const explainers = (list: Explainer[]): ReadonlyMap<string, Explainer> => new Map(list.map((e) => [e.name, e]));

const INIT: Explainer = {
  name: "init",
  kind: "hook",
  summary: "Fires once WordPress has loaded everything it needs.",
  example: "add_action( 'init', 'my_setup' );",
};
const KSES: Explainer = { name: "kses_init", kind: "function", summary: "Sets up the HTML filters for post content." };
const TICKET: Ticket = {
  callback: "kses_init",
  priority: 0,
  origin: "core",
  demo: false,
  file: "wp-includes/kses.php",
};

describe("storyCards", () => {
  it("gives a hook its kind, summary, example and official docs link", () => {
    expect(storyCards(explainers([INIT]), [], "init")).toEqual({
      init: {
        kind: "Hook",
        summary: INIT.summary,
        example: INIT.example,
        demo: false,
        docs: "https://developer.wordpress.org/reference/hooks/init/",
        origin: null,
        priority: null,
        hook: null,
      },
    });
  });

  it("merges a ticket into its explainer: origin, priority and the hook it waits on", () => {
    expect(storyCards(explainers([KSES]), [TICKET], "init").kses_init).toEqual({
      kind: "Listener",
      summary: KSES.summary,
      example: null,
      demo: false,
      docs: "https://developer.wordpress.org/reference/functions/kses_init/",
      origin: "core",
      priority: 0,
      hook: "init",
    });
  });

  it("still gives a ticket without an explainer a card", () => {
    expect(storyCards(explainers([]), [TICKET], "init").kses_init).toMatchObject({
      kind: "Listener",
      summary: null,
      docs: null,
      origin: "core",
    });
  });

  it("never links demo items to the official docs", () => {
    const demoTicket: Ticket = { ...TICKET, callback: "hooked_demo_init", origin: "plugin", demo: true };
    const demoExplainer: Explainer = { name: "my_demo", kind: "function", summary: "A made-up function.", demo: true };
    const cards = storyCards(explainers([demoExplainer]), [demoTicket], "init");
    expect(cards.hooked_demo_init).toMatchObject({ demo: true, docs: null });
    expect(cards.my_demo).toMatchObject({ demo: true, docs: null });
  });

  it("has no docs link for names without a reference page", () => {
    const file: Explainer = { name: "wp-settings.php", kind: "file", summary: "Loads the rest of WordPress." };
    expect(storyCards(explainers([file]), [], "init")["wp-settings.php"]).toMatchObject({ kind: "File", docs: null });
  });
});
