import { describe, expect, it } from "vitest";
import { formatExpected, requiredFiles, scenariosDigest } from "./expected.ts";

describe("requiredFiles", () => {
  it("lists the files plugin.php requires from its own folder, in order", () => {
    const source = [
      "<?php",
      "require __DIR__ . '/class-wp-hook.php';",
      "require_once __DIR__ . '/class-wp-filter-sentinel.php';",
      "global $wp_filter;",
    ].join("\n");
    expect(requiredFiles(source)).toEqual(["class-wp-hook.php", "class-wp-filter-sentinel.php"]);
  });

  it("ignores requires that leave the folder or are built at runtime", () => {
    const source = [
      "require __DIR__ . '/../wp-config.php';",
      "require __DIR__ . '/sub/dir.php';",
      "require ABSPATH . WPINC . '/option.php';",
      "// require __DIR__ . '/commented.php';",
    ].join("\n");
    expect(requiredFiles(source)).toEqual([]);
  });
});

describe("scenariosDigest", () => {
  it("ignores formatting but not content", () => {
    const compact = '{"scenarios":[{"id":"a","steps":[["do","h"]]}]}';
    const pretty = '{\n  "scenarios": [\n    { "id": "a", "steps": [["do", "h"]] }\n  ]\n}\n';
    const changed = '{"scenarios":[{"id":"a","steps":[["do","g"]]}]}';
    expect(scenariosDigest(pretty)).toBe(scenariosDigest(compact));
    expect(scenariosDigest(changed)).not.toBe(scenariosDigest(compact));
    expect(scenariosDigest(compact)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("ignores the $comment, which is documentation", () => {
    expect(scenariosDigest('{"$comment":"notes","scenarios":[]}')).toBe(scenariosDigest('{"scenarios":[]}'));
  });
});

describe("formatExpected", () => {
  it("records where the recording came from, then each step of a scenario on its own line", () => {
    const recording = {
      wp: "7.1.5",
      php: "8.4.14",
      scenariosSha256: "ab".repeat(32),
      files: { "wp-includes/plugin.php": "0123456789abcdef0123456789abcdef" },
      scenarios: {
        one: [
          ["do", "h"],
          ["call", "a", [""]],
        ],
        two: [],
      },
    };
    const text = formatExpected(recording);
    expect(text).toBe(
      [
        "{",
        '  "wp": "7.1.5",',
        '  "php": "8.4.14",',
        `  "scenariosSha256": "${"ab".repeat(32)}",`,
        '  "files": {"wp-includes/plugin.php":"0123456789abcdef0123456789abcdef"},',
        '  "scenarios": {',
        '    "one": [',
        '      ["do","h"],',
        '      ["call","a",[""]]',
        "    ],",
        '    "two": []',
        "  }",
        "}",
        "",
      ].join("\n"),
    );
    expect(JSON.parse(text)).toEqual(recording);
  });
});
