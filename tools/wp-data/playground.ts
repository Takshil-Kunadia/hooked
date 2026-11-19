/**
 * Starting a throwaway WordPress in Playground and sending the warm-up and traced request for
 * each scenario. A trace is only accepted when the response is the one the scenario expects.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { cp, open, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { z } from "zod";
import type { Scenario } from "../../src/lib/wp-data/scenarios.ts";
import { tracerDumpSchema, type TracerDump } from "../../src/lib/wp-data/schema.ts";
import { ADMIN_COOKIES_FILE, blueprintFor } from "./blueprints.ts";
import { MOUNTS, PHP_VERSION, PLAYGROUND_CLI, TOOL_DIR, TRACE_OUT_VFS, type SiteSpec } from "./config.ts";
import { keepCookies } from "./cookies.ts";

const READY_TIMEOUT_MS = 300_000;
const REQUEST_TIMEOUT_MS = 120_000;
const DUMP_TIMEOUT_MS = 20_000;
const ATTEMPTS = 3;
const READY_LINE = /^Ready! WordPress is running on /m;

export interface RunningSite {
  readonly baseUrl: string;
  readonly cookies: Map<string, string>;
  stop(): Promise<void>;
}

/* ---------- process lifecycle ---------- */

const live = new Set<ChildProcess>();

/** Signal a whole process group (npx/pnpm, node, PHP workers), ignoring groups that are already gone. */
function signalGroup(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.pid === undefined) return;
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}

async function stopProcess(child: ChildProcess): Promise<void> {
  live.delete(child);
  const exited = child.exitCode !== null || child.signalCode !== null;
  const exit = exited ? Promise.resolve() : new Promise<void>((resolve) => child.once("exit", () => resolve()));
  signalGroup(child, "SIGTERM");
  await Promise.race([exit, sleep(10_000)]);
  // The group leader can exit before its children; make sure nothing in the group survives.
  signalGroup(child, "SIGKILL");
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    for (const child of live) signalGroup(child, "SIGKILL");
    process.exit(130);
  });
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() =>
        typeof address === "object" && address ? resolve(address.port) : reject(new Error("no port")),
      );
    });
  });
}

async function tail(file: string, lines = 15): Promise<string> {
  const text = await readFile(file, "utf8").catch(() => "");
  return text.trimEnd().split("\n").slice(-lines).join("\n");
}

/**
 * Playground answers HTTP before its blueprint has finished, so an early request would see a site
 * without our theme, permalinks or cookies. Only its own "Ready!" line means the setup is done.
 */
async function waitUntilReady(logFile: string, child: ChildProcess, failed: Promise<never>): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Playground stopped early (${child.exitCode ?? child.signalCode})`);
    }
    const log = await Promise.race([readFile(logFile, "utf8").catch(() => ""), failed]);
    if (READY_LINE.test(log)) return;
    await sleep(1_000);
  }
  throw new Error(`Playground was not ready after ${READY_TIMEOUT_MS / 1000}s`);
}

/**
 * Copies the tracer and fixtures next to the run's output and returns the copies' mount flags.
 * Mounts are writable from inside WordPress, so the site never gets a path into the repository.
 */
async function mountCopies(outDir: string, extra: ReadonlyArray<readonly [string, string]>): Promise<string[]> {
  const sources = [...MOUNTS.map(([host, vfs]) => [path.join(TOOL_DIR, host), vfs] as const), ...extra];
  const flags: string[] = [];
  for (const [index, [source, vfs]] of sources.entries()) {
    const copy = path.join(outDir, "mounts", String(index), path.basename(source));
    await cp(source, copy, { recursive: true });
    flags.push(`--mount=${copy}:${vfs}`);
  }
  return flags;
}

function playgroundArgs(wp: string, port: number, blueprint: string, mounts: string[], outDir: string): string[] {
  return [
    "dlx",
    `${PLAYGROUND_CLI.name}@${PLAYGROUND_CLI.version}`,
    "server",
    `--wp=${wp}`,
    `--php=${PHP_VERSION}`,
    `--port=${port}`,
    // One worker: requests are sequential anyway, and a single PHP runtime keeps runs repeatable.
    "--workers=1",
    `--blueprint=${blueprint}`,
    ...mounts,
    `--mount=${outDir}:${TRACE_OUT_VFS}`,
  ];
}

/** Extra [host path, Playground path] mounts, such as the classic site's parent theme. */
export type Mounts = ReadonlyArray<readonly [string, string]>;

export async function startSite(
  wp: string,
  spec: SiteSpec,
  outDir: string,
  logFile: string,
  extraMounts: Mounts = [],
): Promise<RunningSite> {
  const port = await freePort();
  const blueprint = path.join(outDir, `blueprint-${port}.json`);
  await writeFile(blueprint, JSON.stringify(blueprintFor(spec, { wp, php: PHP_VERSION }), null, 2));
  const log = await open(logFile, "w");
  const mounts = await mountCopies(outDir, extraMounts);
  const child = spawn("pnpm", playgroundArgs(wp, port, blueprint, mounts, outDir), {
    detached: true,
    stdio: ["ignore", log.fd, log.fd],
  });
  live.add(child);
  const failed = new Promise<never>((_, reject) => child.once("error", reject));
  failed.catch(() => undefined);
  const stop = async (): Promise<void> => {
    await stopProcess(child);
    await log.close();
  };
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await waitUntilReady(logFile, child, failed);
    // Playground answers the very first request with a redirect to the same URL (it resets its
    // auto-login state). Spend that on a throwaway request so no scenario ever sees it.
    const first = await fetch(`${baseUrl}/`, { redirect: "manual", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    await first.arrayBuffer();
  } catch (error) {
    await stop();
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\n--- ${logFile}\n${await tail(logFile)}`,
    );
  }
  return { baseUrl, cookies: new Map(), stop };
}

/* ---------- requests ---------- */

interface SendOptions {
  readonly method: "GET" | "POST";
  readonly body?: string;
  readonly trace?: string;
}

async function send(site: RunningSite, url: string, options: SendOptions): Promise<Response> {
  const headers = new Headers();
  if (site.cookies.size > 0) {
    headers.set("cookie", [...site.cookies].map(([name, value]) => `${name}=${value}`).join("; "));
  }
  if (options.body !== undefined) headers.set("content-type", "application/x-www-form-urlencoded");
  if (options.trace) headers.set("x-hooked-trace", options.trace);
  const response = await fetch(url, {
    method: options.method,
    body: options.body,
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  keepCookies(site.cookies, response.headers.getSetCookie());
  await response.arrayBuffer();
  return response;
}

const adminCookiesSchema = z.record(z.string().regex(/^wordpress_\w+$/), z.string().min(1));

/** Uses the administrator cookies the blueprint minted, and checks the dashboard accepts them. */
export async function applyAdminCookies(site: RunningSite, outDir: string): Promise<void> {
  const text = await readFile(path.join(outDir, ADMIN_COOKIES_FILE), "utf8");
  for (const [name, value] of Object.entries(adminCookiesSchema.parse(JSON.parse(text)))) {
    site.cookies.set(name, encodeURIComponent(value));
  }
  const response = await send(site, `${site.baseUrl}/wp-admin/`, { method: "GET" });
  if (response.status !== 200) {
    const location = response.headers.get("location");
    throw new Error(
      `The admin cookies were not accepted: /wp-admin/ answered ${response.status}${location ? ` (→ ${location})` : ""}`,
    );
  }
}

async function readDump(file: string, scenario: string): Promise<TracerDump> {
  const deadline = Date.now() + DUMP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const text = await readFile(file, "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (text !== null) {
      const result = tracerDumpSchema.safeParse(JSON.parse(text));
      if (!result.success) throw new Error(`${scenario}: the tracer's output is not valid: ${result.error.message}`);
      return result.data;
    }
    await sleep(100);
  }
  throw new Error(`${scenario}: the tracer did not write ${file}`);
}

/** Why a traced response can't be used, or null when it is what the scenario expects. */
function problemWith(scenario: Scenario, response: Response, dump: TracerDump): string | null {
  if (response.status !== scenario.expectedStatus) {
    const location = response.headers.get("location");
    return `answered ${response.status}, expected ${scenario.expectedStatus}${location ? ` (→ ${location})` : ""}`;
  }
  const fired = new Set(dump.events.map(([name]) => name));
  const missing = (scenario.mustFire ?? []).filter((hook) => !fired.has(hook));
  return missing.length > 0 ? `never fired ${missing.join(", ")}` : null;
}

/** Warm-up first (first visits build caches and options), then the request that gets traced. */
export async function traceScenario(
  site: RunningSite,
  scenario: Scenario,
  outDir: string,
): Promise<{ status: number; dump: TracerDump }> {
  const url = `${site.baseUrl}${scenario.path}`;
  let problem = "";
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const warmUp = await send(site, url, { method: scenario.method, body: scenario.body });
    if (warmUp.status >= 500) throw new Error(`${scenario.id}: the warm-up request answered ${warmUp.status}`);
    if (scenario.settleMs) await sleep(scenario.settleMs);
    const response = await send(site, url, { method: scenario.method, body: scenario.body, trace: scenario.id });
    const dump = await readDump(path.join(outDir, `${scenario.id}.json`), scenario.id);
    problem = problemWith(scenario, response, dump) ?? "";
    if (!problem) return { status: response.status, dump };
  }
  throw new Error(`${scenario.id}: ${problem} (after ${ATTEMPTS} attempts)`);
}
