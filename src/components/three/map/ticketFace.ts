import { CanvasTexture, SRGBColorSpace } from "three";
import { ORIGIN_COLOURS } from "@/lib/design/tokens";
import type { Origin } from "@/lib/metro/route";
import type { Ticket } from "@/lib/story/facts";
import { toneCompensatedCss } from "../palette";
import type { LabelFonts } from "./labels";

/**
 * Round 5's pass face, drawn at its 320 px design size: about twice the pass's largest size on
 * screen (wide layout, highlighted, 2× pixels), so 16 faces stay near 10 MB of texture memory.
 */
const W = 320;
const H = 460;

/** Round 5's colours; passes are drawn the same in both tiles. */
const DARK = "#16171b";
const INK = "#1d1d1f";
const WHITE = "#ffffff";

/** The origin printed on the pass: meaning never rides on colour alone. */
const ORIGIN_LABELS: Readonly<Record<Origin, string>> = {
  core: "CORE",
  plugin: "PLUGIN",
  theme: "THEME",
  mu: "MU-PLUGIN",
  dropin: "DROP-IN",
};

/** Pre-compensated like the map labels, so the passes match the board's origin chips exactly. */
const exact = toneCompensatedCss;

interface FaceInk {
  readonly card: string;
  readonly kicker: string;
  readonly number: string;
  readonly rule: string;
  readonly origin: string;
}

/** Waiting passes are dark with white type; done passes take their origin colour with dark type. */
function faceInk(origin: Origin, done: boolean): FaceInk {
  const colour = ORIGIN_COLOURS[origin];
  return done
    ? { card: exact(colour), kicker: exact(INK, 0.62), number: exact(INK), rule: exact(INK, 0.35), origin: exact(INK) }
    : {
        card: exact(DARK),
        kicker: exact(WHITE, 0.58),
        number: exact(WHITE),
        rule: exact(WHITE, 0.25),
        origin: exact(colour),
      };
}

/** The ticket number: the priority, big; long values shrink to fit the pass. */
function drawNumber(g: CanvasRenderingContext2D, text: string, fonts: LabelFonts): void {
  const size = text.length > 1 ? 172 : 200;
  g.font = `800 ${size}px ${fonts.sans}`;
  const fit = Math.min(1, (W * 0.82) / Math.max(1, g.measureText(text).width));
  if (fit < 1) g.font = `800 ${Math.floor(size * fit)}px ${fonts.sans}`;
  g.fillText(text, W / 2, H * 0.43);
}

/** Round 5's ✓ badge in the top-right corner of a done pass. */
function drawBadge(g: CanvasRenderingContext2D, origin: Origin): void {
  g.fillStyle = exact(INK);
  g.beginPath();
  g.arc(W - 50, 50, 30, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = exact(ORIGIN_COLOURS[origin]);
  g.lineWidth = 9;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.beginPath();
  g.moveTo(W - 63, 51);
  g.lineTo(W - 53, 61);
  g.lineTo(W - 36, 40);
  g.stroke();
}

function drawFace(g: CanvasRenderingContext2D, ticket: Ticket, done: boolean, fonts: LabelFonts): void {
  const ink = faceInk(ticket.origin, done);
  g.clearRect(0, 0, W, H);
  g.fillStyle = ink.card;
  g.beginPath();
  g.roundRect(0, 0, W, H, 30);
  g.fill();
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = ink.kicker;
  g.font = `34px ${fonts.mono}`;
  g.fillText("TICKET", W / 2, 50);
  g.fillStyle = ink.number;
  drawNumber(g, String(ticket.priority), fonts);
  g.setLineDash([10, 10]);
  g.strokeStyle = ink.rule;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(26, H * 0.7);
  g.lineTo(W - 26, H * 0.7);
  g.stroke();
  g.setLineDash([]);
  g.fillStyle = ink.origin;
  g.font = `40px ${fonts.mono}`;
  g.fillText(ORIGIN_LABELS[ticket.origin], W / 2, H * 0.84);
  if (done) drawBadge(g, ticket.origin);
}

/** A pass face, waiting or done, as an unlit sRGB texture. */
export function ticketFaceTexture(ticket: Ticket, done: boolean, fonts: LabelFonts, anisotropy: number): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("Can't draw ticket passes: this browser has no 2D canvas");
  drawFace(g, ticket, done, fonts);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = anisotropy;
  return texture;
}
