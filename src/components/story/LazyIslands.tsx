"use client";

import dynamic from "next/dynamic";

/*
 * The hover card and the departure board are never part of the first paint (no card is open, and the
 * server renders the hero, which has no board), so they load after hydration rather than with the
 * route's initial JS. A Server Component's dynamic import isn't code-split, hence this client module.
 */

export const LazyHookCard = dynamic(() => import("./HookCard").then((m) => m.HookCard), {
  ssr: false,
  loading: () => null,
});

export const LazyDepartureBoard = dynamic(() => import("./DepartureBoard").then((m) => m.DepartureBoard), {
  ssr: false,
  loading: () => null,
});
