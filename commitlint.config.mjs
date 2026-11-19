/** Conventional commits: feat, fix, refactor, docs, test, chore, perf, ci. */
const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [2, "always", ["feat", "fix", "refactor", "docs", "test", "chore", "perf", "ci"]],
  },
};

export default config;
