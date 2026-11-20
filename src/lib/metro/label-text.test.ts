import { describe, expect, it } from "vitest";
import { subLabelText } from "./label-text";
import { STATIONS } from "./route";

describe("subLabelText", () => {
  it("prints plain-English sub-labels in capitals, like round 5", () => {
    expect(subLabelText("start & finish")).toBe("START & FINISH");
    expect(subLabelText("nginx or Apache")).toBe("NGINX OR APACHE");
    expect(subLabelText("the depot")).toBe("THE DEPOT");
  });

  it("never changes the case of code: hook names are case-sensitive", () => {
    expect(subLabelText("do_action( 'init' )")).toBe("do_action( 'init' )");
    expect(subLabelText("$wp->init()")).toBe("$wp->init()");
    expect(subLabelText("loads wp-config.php")).toBe("loads wp-config.php");
    expect(subLabelText("WP_Query::get_posts")).toBe("WP_Query::get_posts");
  });

  it("keeps underscores and file names intact", () => {
    expect(subLabelText("the_title")).toBe("the_title");
    expect(subLabelText("boards at wp-settings")).toBe("boards at wp-settings");
  });

  it("keeps every code sub-label on the map in its case", () => {
    const init = STATIONS.find((s) => s.id === "init");
    expect(init && subLabelText(init.sub)).toBe("do_action( 'init' )");
  });

  it("leaves an empty sub-label empty", () => {
    expect(subLabelText("")).toBe("");
  });
});
