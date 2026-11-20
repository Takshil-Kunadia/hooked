/**
 * What each hover card shows, built on the server: explainers (validated with zod there) merged with
 * the init tickets, so client components receive plain data and never load zod.
 */
import type { Origin } from "@/lib/metro/route";
import type { Priority } from "@/lib/wp-data/trace";
import { docsLink, type Explainer } from "./explainers";
import type { Ticket } from "./facts";

export interface CardInfo {
  /** Display label: "Hook", "Function", "File", "Concept", or "Listener" for a ticket. */
  readonly kind: string;
  readonly summary: string | null;
  readonly example: string | null;
  /** Made up for this demo, not in core. */
  readonly demo: boolean;
  /** The developer.wordpress.org reference page; null when there is none (and always for demos). */
  readonly docs: string | null;
  readonly origin: Origin | null;
  readonly priority: Priority | null;
  /** The hook a ticket waits on. */
  readonly hook: string | null;
}

const KIND_LABELS: Readonly<Record<Explainer["kind"], string>> = {
  hook: "Hook",
  function: "Function",
  file: "File",
  concept: "Concept",
};

function cardFor(explainer: Explainer | undefined, ticket: Ticket | undefined, hook: string): CardInfo {
  const demo = explainer?.demo === true || ticket?.demo === true;
  const link = explainer ? docsLink(explainer) : null;
  return {
    kind: explainer && !ticket ? KIND_LABELS[explainer.kind] : "Listener",
    summary: explainer?.summary ?? null,
    example: explainer?.example ?? null,
    demo,
    docs: demo ? null : link,
    origin: ticket?.origin ?? null,
    priority: ticket?.priority ?? null,
    hook: ticket ? hook : null,
  };
}

/** Every card by name: each explainer, and each of `hook`'s tickets (with or without an explainer). */
export function storyCards(
  explainers: ReadonlyMap<string, Explainer>,
  tickets: ReadonlyArray<Ticket>,
  hook: string,
): Record<string, CardInfo> {
  const byCallback = new Map(tickets.map((t) => [t.callback, t]));
  const names = new Set([...explainers.keys(), ...byCallback.keys()]);
  return Object.fromEntries(
    [...names].map((name) => [name, cardFor(explainers.get(name), byCallback.get(name), hook)]),
  );
}
