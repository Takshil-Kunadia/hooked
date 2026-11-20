import type { HoodRow } from "@/lib/story/hood";
import { Hook } from "./Hook";

interface UnderTheHoodProps {
  /** The act's hooks in fired order, from `hoodRows`. */
  readonly rows: ReadonlyArray<HoodRow>;
  /** The WordPress release the lines belong to. */
  readonly wp: string;
}

/**
 * An act's "Under the hood" list for developers: each hook, in the order it fired, linked to the
 * line in core that fires it. Server-rendered, a native `<details>`, so it works without JS. Renders
 * nothing for an act whose beats name no hooks.
 */
export function UnderTheHood({ rows, wp }: UnderTheHoodProps) {
  if (rows.length === 0) return null;
  return (
    <details className="story-hood">
      <summary>Under the hood</summary>
      <p>Where WordPress {wp} fires each hook, in the order they ran:</p>
      <ol>
        {rows.map((row) => (
          <li key={row.name}>
            <Hook name={row.name} />{" "}
            <a href={row.url} target="_blank" rel="noopener noreferrer">
              {row.file}:{row.line}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ol>
    </details>
  );
}
