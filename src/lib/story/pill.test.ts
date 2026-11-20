import { describe, expect, it } from "vitest";
import { pillSpot, pillText } from "./pill";

const DATA = { request: { method: "GET", path: "/hello-world/" }, status: 200 };

describe("pillText", () => {
  it("shows the request from the data", () => {
    expect(pillText("request", DATA)).toBe("GET /hello-world/");
  });

  it("shows the init announcement", () => {
    expect(pillText("init", DATA)).toBe("do_action( 'init' )");
  });

  it("shows the response status with its reason phrase", () => {
    expect(pillText("response", DATA)).toBe("200 OK");
    expect(pillText("response", { ...DATA, status: 404 })).toBe("404 Not Found");
  });

  it("shows a bare status code it has no phrase for", () => {
    expect(pillText("response", { ...DATA, status: 299 })).toBe("299");
  });
});

describe("pillSpot", () => {
  const viewport = { w: 1000, h: 800 };
  const pill = { w: 160, h: 30 };
  const train = { x: 500, y: 400, visible: true };

  it("sits centred just above the train", () => {
    expect(pillSpot(train, pill, viewport, [])).toEqual({ x: 420, y: 356 });
  });

  it("stays inside the viewport at the edges", () => {
    expect(pillSpot({ ...train, x: 20 }, pill, viewport, [])).toEqual({ x: 10, y: 356 });
    expect(pillSpot({ ...train, x: 990 }, pill, viewport, [])).toEqual({ x: 830, y: 356 });
  });

  it("hides while the train is out of view", () => {
    expect(pillSpot({ ...train, visible: false }, pill, viewport, [])).toBeNull();
    expect(pillSpot({ ...train, y: 20 }, pill, viewport, [])).toBeNull();
    expect(pillSpot({ ...train, y: 900 }, pill, viewport, [])).toBeNull();
  });

  it("hides rather than cover the copy or a board, keeping a 20px berth", () => {
    expect(pillSpot(train, pill, viewport, [{ x: 0, y: 0, w: 410, h: 800 }])).toBeNull();
    expect(pillSpot(train, pill, viewport, [{ x: 0, y: 0, w: 400, h: 800 }])).toEqual({ x: 420, y: 356 });
    expect(pillSpot(train, pill, viewport, [{ x: 400, y: 386, w: 200, h: 100 }])).toBeNull();
  });
});
