"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { useStore } from "zustand";
import type { CardInfo } from "@/lib/story/cards";
import { graceMs, pointerHover } from "@/lib/story/hover-intent";
import { isLinked, linkedCard } from "@/lib/story/linked";
import { placeCardNear, type Rect } from "@/lib/story/placement";
import { storyStore, type StoryState } from "@/lib/story/store";
import { avoidRects } from "./dom";

const CARD = "[data-card]";
/** Copy words (`<Hook>`, server-rendered); board rows mark their own link in React. */
const WORD = "code[data-card]";
/** The stage container: clicks there belong to 3D picking (a hit pins, a miss unpins). */
const STAGE = "[data-stage]";
const FOCUSABLE = "a[href], button";
/** A card opened from the 3D scene sits this far from the pointer. */
const POINTER_OFFSET = 8;

/** What the open card points at: a word or board row, or the pointer for a pick in the 3D scene. */
type Anchor = Element | { readonly x: number; readonly y: number };

/** Event-handler state shared with the component; never read during render. */
interface CardContext {
  /** The `[data-card]` element behind the latest DOM request, consumed by the next name change. */
  source: Element | null;
  anchor: Anchor | null;
  pointer: { x: number; y: number };
  /** Move focus into the card once it renders pinned (it was pinned from the keyboard). */
  focusOnOpen: boolean;
}

const createContext = (): CardContext => ({ source: null, anchor: null, pointer: { x: 0, y: 0 }, focusOnOpen: false });

function cardHost(target: EventTarget | null): readonly [Element, string] | null {
  const host = target instanceof Element ? target.closest(CARD) : null;
  const name = host?.getAttribute("data-card");
  return host && name ? [host, name] : null;
}

/** Closes the card; if focus was inside it, focus goes back to the word that opened it. */
function closeCard(ctx: CardContext, card: HTMLElement | null): void {
  const returnTo = card?.contains(document.activeElement) && ctx.anchor instanceof HTMLElement ? ctx.anchor : null;
  storyStore.getState().pin(null);
  returnTo?.focus({ preventScroll: true });
}

/** Marks every copy word showing the open card, wherever it was opened (a word, a row, the map). */
function markLinkedWords(linked: string | null): void {
  for (const el of document.querySelectorAll(WORD)) {
    el.toggleAttribute("data-linked", isLinked(el.getAttribute("data-card") ?? "", linked));
  }
}

/** Whether a copy word is where the story is: in the current beat, or after the current act's beats. */
function shownAt(el: Element, at: Pick<StoryState, "actId" | "beat">): boolean {
  if (el.closest("section")?.id !== at.actId) return false;
  const li = el.closest("[data-beats] > li");
  return li === null || Array.from(li.parentElement?.children ?? []).indexOf(li) === at.beat;
}

/** The copy word or board row holding keyboard focus, if it is where the story is now. */
function focusedWordAt(at: StoryState): Element | null {
  const el = document.activeElement;
  return el && cardHost(el)?.[0] === el && el.matches(":focus-visible") && shownAt(el, at) ? el : null;
}

/**
 * The beat moved on: a word's card closes, unless that word holds keyboard focus and is now on
 * screen. Tabbing into another beat scrolls the page there (StoryController), so its card opens on
 * arrival. (A tapped word keeps focus too, but its card stays closed when the reader scrolls back.)
 */
function followBeat(ctx: CardContext, card: HTMLElement | null, at: StoryState): void {
  const word = focusedWordAt(at);
  if (ctx.anchor instanceof Element && ctx.anchor !== word) closeCard(ctx, card);
  const name = word?.getAttribute("data-card");
  const s = storyStore.getState();
  if (!word || !name || s.pinned !== null || s.hovered === name) return;
  ctx.source = word;
  s.hover(name);
}

/**
 * Delegated listeners for every `[data-card]` (copy words, board rows), plus the store links to 3D
 * picking: hovering a word highlights it in the scene, and a pick in the scene opens its card.
 * Hover follows mouse and pen only, through `pointerHover` (the card stays while the pointer is on
 * its word or on the card); a tap or click pins; Esc closes.
 */
function bindCards(ctx: CardContext, cardRef: RefObject<HTMLDivElement | null>): () => void {
  const store = storyStore.getState;
  const onOver = (e: PointerEvent): void => {
    const hit = e.pointerType === "touch" ? null : cardHost(e.target);
    if (!hit) return;
    ctx.source = hit[0];
    pointerHover.send({ type: "anchor", name: hit[1] });
  };
  const onOut = (e: PointerEvent): void => {
    const hit = e.pointerType === "touch" ? null : cardHost(e.target);
    if (!hit || (e.relatedTarget instanceof Node && hit[0].contains(e.relatedTarget))) return;
    pointerHover.send({ type: "anchor", name: null });
  };
  const onFocusIn = (e: FocusEvent): void => {
    const hit = cardHost(e.target);
    if (!hit) return;
    ctx.source = hit[0];
    if (store().pinned !== null && store().pinned !== hit[1]) store().pin(null);
    store().hover(hit[1]);
  };
  const onFocusOut = (e: FocusEvent): void => {
    const hit = cardHost(e.target);
    if (!hit || (e.relatedTarget instanceof Node && hit[0].contains(e.relatedTarget))) return;
    if (store().pinned === null && store().hovered === hit[1]) store().hover(null);
  };
  const onClick = (e: MouseEvent): void => {
    if (e.target instanceof Node && cardRef.current?.contains(e.target)) return;
    const hit = cardHost(e.target);
    if (hit) {
      ctx.source = hit[0];
      store().pin(hit[1]);
    } else if (!(e.target instanceof Element && e.target.closest(STAGE)) && store().pinned !== null) {
      store().pin(null);
    }
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape" && (store().pinned ?? store().hovered) !== null) {
      pointerHover.send({ type: "dismiss" });
      closeCard(ctx, cardRef.current);
      return;
    }
    const hit = e.key === "Enter" || e.key === " " ? cardHost(e.target) : null;
    if (!hit || e.target !== hit[0]) return;
    e.preventDefault();
    ctx.source = hit[0];
    ctx.focusOnOpen = true;
    store().pin(hit[1]);
  };
  const onMove = (e: PointerEvent): void => {
    ctx.pointer = { x: e.clientX, y: e.clientY };
  };
  /* a word's card follows its word while the page scrolls (a focused word's beat sliding into place) */
  let frame = 0;
  const follow = (): void => {
    frame = 0;
    if (cardRef.current && ctx.anchor instanceof Element) positionCard(cardRef.current, ctx);
  };
  const onScroll = (): void => {
    if (frame === 0 && ctx.anchor instanceof Element) frame = requestAnimationFrame(follow);
  };
  /* resolve where the card points whenever its name changes; follow the beat when it moves on */
  const unsubscribe = storyStore.subscribe((s, prev) => {
    const name = linkedCard(s);
    const source = ctx.source;
    ctx.source = null;
    if (name !== linkedCard(prev)) {
      const fromWord = source !== null && source.getAttribute("data-card") === name;
      ctx.anchor = name === null ? null : fromWord ? source : ctx.pointer;
      markLinkedWords(name);
    }
    if (s.globalIndex !== prev.globalIndex) followBeat(ctx, cardRef.current, s);
  });

  const listeners = [
    ["pointerover", onOver],
    ["pointerout", onOut],
    ["focusin", onFocusIn],
    ["focusout", onFocusOut],
    ["click", onClick],
    ["keydown", onKey],
  ] as const;
  for (const [type, fn] of listeners) document.addEventListener(type, fn as EventListener);
  document.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => {
    unsubscribe();
    for (const [type, fn] of listeners) document.removeEventListener(type, fn as EventListener);
    document.removeEventListener("pointermove", onMove);
    window.removeEventListener("scroll", onScroll);
    cancelAnimationFrame(frame);
  };
}

function anchorRect(anchor: Anchor | null, pointer: { x: number; y: number }): Rect {
  if (anchor instanceof Element) {
    const r = anchor.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }
  const at = anchor ?? pointer;
  return { x: at.x + POINTER_OFFSET, y: at.y + POINTER_OFFSET, w: 0, h: 0 };
}

/**
 * Places the card beside what it points at, clear of the copy, boards and header, and gives the
 * pointer time to cross the gap: a card pushed past the copy column waits longer.
 */
function positionCard(el: HTMLElement, ctx: CardContext): void {
  const viewport = { w: window.innerWidth, h: window.innerHeight };
  const anchor = anchorRect(ctx.anchor, ctx.pointer);
  const size = { w: el.offsetWidth, h: el.offsetHeight };
  const spot = placeCardNear(anchor, size, viewport, avoidRects());
  el.style.transform = `translate(${Math.round(spot.x)}px, ${Math.round(spot.y)}px)`;
  pointerHover.setGrace(graceMs(anchor, { ...spot, ...size }));
}

/** The pointer on the card keeps it open (mouse and pen; a tap pins instead). */
function onCardPointer(e: ReactPointerEvent<HTMLDivElement>): void {
  if (e.pointerType !== "touch") pointerHover.send({ type: "card", inside: e.type === "pointerenter" });
}

/** Places the card; moves focus in if it was pinned by keyboard. */
function placeCardElement(el: HTMLElement, ctx: CardContext, pinned: boolean): void {
  positionCard(el, ctx);
  if (pinned && ctx.focusOnOpen) {
    ctx.focusOnOpen = false;
    el.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
  }
}

interface HookCardProps {
  /** What each card shows, by name (plain data built on the server). */
  readonly cards: Readonly<Record<string, CardInfo>>;
  /** The WordPress version the story describes. */
  readonly wp: string;
}

/** The hover card for copy words, board rows and 3D map objects. */
export function HookCard({ cards, wp }: HookCardProps) {
  const name = useStore(storyStore, linkedCard);
  const pinned = useStore(storyStore, (s) => s.pinned !== null);
  const [ctx] = useState(createContext);
  const cardRef = useRef<HTMLDivElement>(null);
  const info = name !== null && Object.hasOwn(cards, name) ? cards[name] : undefined;

  useEffect(() => bindCards(ctx, cardRef), [ctx]);
  useLayoutEffect(() => {
    if (cardRef.current && info) placeCardElement(cardRef.current, ctx, pinned);
  }, [ctx, name, info, pinned]);

  if (name === null || !info) return null;
  return (
    <div
      ref={cardRef}
      className="hook-card"
      data-pinned={pinned ? "" : undefined}
      onPointerEnter={onCardPointer}
      onPointerLeave={onCardPointer}
      role="dialog"
      aria-labelledby="hook-card-name"
      aria-live="polite"
    >
      {pinned && (
        <button
          type="button"
          className="hook-card-close"
          aria-label="Close details"
          onClick={() => closeCard(ctx, cardRef.current)}
        >
          ×
        </button>
      )}
      <p id="hook-card-name" className="hook-card-name">
        {name}
      </p>
      <p className="hook-card-meta">
        <span>{info.kind}</span>
        {info.origin && <span className={`chip chip-${info.origin}`}>{info.origin}</span>}
        {info.priority !== null && <span>ticket {info.priority}</span>}
        {info.hook && <span>at {info.hook}</span>}
      </p>
      {info.summary && <p className="hook-card-what">{info.summary}</p>}
      {info.example && <pre className="hook-card-ex">{info.example}</pre>}
      <p className="hook-card-foot">
        <span>{info.demo ? "Made up for this demo. Not in core." : `WordPress ${wp}`}</span>
        {info.docs && (
          <a href={info.docs} target="_blank" rel="noopener noreferrer">
            Official docs ↗<span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
      </p>
    </div>
  );
}
