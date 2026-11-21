/**
 * Chapter 1, "The journey of a request": from your browser to `init`. Plain data, so the page can
 * hand it to the 3D stage. Each beat says where the train stops, what the camera frames, which map
 * labels show (focus mode) and which hooks the beat talks about (checked against the real catalog).
 * The words live in copy.tsx, by beat id.
 */
import { STATIONS } from "@/lib/metro/route";
import type { BeatSpec, ChapterSpec, FocusId } from "@/lib/story/chapter";

/** The first act is the page's hero: page.tsx renders it around the `<h1>`, Story renders the rest. */
export const HERO_ACT_ID = "hero";

/** The hero and the overviews show station names only. */
const STATION_NAMES: ReadonlyArray<FocusId> = STATIONS.map((s) => s.id);
/** What the last beat looks ahead to: where we are, and the rest of the line. */
const AHEAD: ReadonlyArray<FocusId> = ["init", "query", "depot", "template", "the_title", "response"];

type BeatInput = Omit<BeatSpec, "focus" | "hooks"> & Partial<Pick<BeatSpec, "focus" | "hooks">>;

/** A beat that, unless it says otherwise, shows its own station's label and names no hooks. */
const beat = (b: BeatInput): BeatSpec => ({ focus: [b.station], hooks: [], ...b });

export const CHAPTER_1: ChapterSpec = {
  id: "chapter-1",
  acts: [
    {
      /* page.tsx writes the hero's words around its LCP <h1>, so the spec leaves them out */
      id: HERO_ACT_ID,
      kicker: "",
      title: "",
      beats: [beat({ id: "hero", rail: "the question", station: "browser", shot: "overview", focus: STATION_NAMES })],
    },
    {
      id: "before",
      kicker: "Stop 0 · Before WordPress",
      title: "First, the web.",
      beats: [
        beat({ id: "address", rail: "you type an address", station: "browser", shot: "station", pill: "request" }),
        beat({ id: "server", rail: "the web server", station: "server", shot: "station" }),
        beat({ id: "php", rail: "PHP runs the code", station: "php", shot: "station" }),
        beat({ id: "database", rail: "the database", station: "php", shot: "depot", focus: ["php", "depot"] }),
        beat({
          id: "response",
          rail: "the page comes back",
          station: "php",
          shot: "web",
          focus: ["browser", "server", "php"],
          pill: "response",
        }),
      ],
    },
    {
      id: "boot",
      kicker: "Boarding · index.php to wp-settings.php",
      title: "All aboard.",
      beats: [
        beat({ id: "index", rail: "index.php", station: "index", shot: "station" }),
        beat({ id: "config", rail: "wp-config.php", station: "config", shot: "station" }),
        beat({ id: "settings", rail: "wp-settings.php", station: "settings", shot: "station" }),
        beat({
          id: "feeders",
          rail: "plugins and the theme",
          station: "settings",
          shot: "feeders",
          focus: ["settings", "feeders"],
          board: "announcements",
          hooks: ["muplugins_loaded", "plugins_loaded", "setup_theme", "after_setup_theme"],
        }),
      ],
    },
    {
      id: "init",
      kicker: "The announcement · init",
      title: "This is an action.",
      beats: [
        beat({ id: "arrive", rail: "arrive at init", station: "init", shot: "platform", hooks: ["init"] }),
        beat({
          id: "announce",
          rail: "the announcement",
          station: "init",
          shot: "platform",
          board: "init",
          pill: "init",
          cue: "announce",
          hooks: ["init"],
        }),
        beat({
          id: "tickets",
          rail: "listeners take turns",
          station: "init",
          shot: "platform",
          board: "init",
          cue: "cascade",
          hooks: ["init"],
        }),
        beat({ id: "loaded", rail: "everything loaded", station: "init", shot: "platform", hooks: ["wp_loaded"] }),
      ],
    },
    {
      id: "next",
      kicker: "Next stop · WP::main()",
      title: "Finding your post.",
      beats: [beat({ id: "next", rail: "next stop", station: "init", shot: "overview", focus: AHEAD })],
    },
  ],
};
