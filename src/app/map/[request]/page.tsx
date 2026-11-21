import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MapPage } from "@/components/lifecycle/MapPage";
import { DEFAULT_REQUEST, getLifecycleMap, getRequestChoices } from "@/lib/lifecycle/data";

/** One page per recorded request; the default one lives at /map. */
export async function generateStaticParams(): Promise<Array<{ request: string }>> {
  const choices = await getRequestChoices();
  return choices.filter((c) => c.id !== DEFAULT_REQUEST).map((c) => ({ request: c.id }));
}

export async function generateMetadata({ params }: PageProps<"/map/[request]">): Promise<Metadata> {
  const { request } = await params;
  const choice = (await getRequestChoices()).find((c) => c.id === request);
  if (!choice) return {};
  return {
    title: `Every hook in ${choice.summary.toLowerCase()}`,
    description: `Every WordPress action and filter that ${choice.method} ${choice.path} fires, in the order it fires, recorded from real WordPress.`,
    alternates: { canonical: `/map/${request}` },
  };
}

async function RequestMap({ params }: Pick<PageProps<"/map/[request]">, "params">) {
  const { request } = await params;
  const choices = await getRequestChoices();
  if (request === DEFAULT_REQUEST || !choices.some((c) => c.id === request)) notFound();
  const map = await getLifecycleMap(request);
  return <MapPage map={map} choices={choices} />;
}

/** The request comes from the address, so it is read behind Suspense (every one is prerendered). */
export default function Page({ params }: PageProps<"/map/[request]">) {
  return (
    <Suspense fallback={<main className="map-hero" aria-busy="true" />}>
      <RequestMap params={params} />
    </Suspense>
  );
}
