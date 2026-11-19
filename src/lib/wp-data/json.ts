/**
 * JSON for committed data files: one array item or record entry per line, so a data PR's diff
 * shows exactly which hooks changed instead of one enormous line.
 */

const isStructured = (value: unknown): boolean => typeof value === "object" && value !== null;

function block(value: unknown): string {
  if (Array.isArray(value) && value.length > 0 && value.every(isStructured)) {
    return `[\n${value.map((item) => `    ${JSON.stringify(item)}`).join(",\n")}\n  ]`;
  }
  if (isStructured(value) && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > 0) {
      return `{\n${entries.map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(",\n")}\n  }`;
    }
  }
  return JSON.stringify(value);
}

export function toDataJson(value: Readonly<Record<string, unknown>>): string {
  const lines = Object.entries(value)
    .filter(([, v]) => v !== undefined)
    .map(([key, v]) => `  ${JSON.stringify(key)}: ${block(v)}`);
  return `{\n${lines.join(",\n")}\n}\n`;
}
