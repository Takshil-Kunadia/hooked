import type { Metadata } from "next";
import { MapPage } from "@/components/lifecycle/MapPage";
import { getLifecycleMap, getRequestChoices } from "@/lib/lifecycle/data";

export const metadata: Metadata = {
  title: "Every hook in one request",
  description:
    "The map of a whole WordPress request: every action and filter one page visit fires, in the order it fires, recorded from real WordPress.",
};

/** The map opens on the single blog post, on the default block theme. */
export default async function Page() {
  const [map, choices] = await Promise.all([getLifecycleMap(), getRequestChoices()]);
  return <MapPage map={map} choices={choices} />;
}
