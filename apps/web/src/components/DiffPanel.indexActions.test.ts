import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("DiffPanel index actions", () => {
  const source = readFileSync(new URL("./DiffPanel.tsx", import.meta.url), "utf8");

  it("shows stage and unstage bulk labels only for index diff scopes", () => {
    expect(source).toContain('repoDiffScope === "unstaged"');
    expect(source).toContain('repoDiffScope === "staged"');
    expect(source).toContain("{indexActionLabel} all");
  });

  it("renders per-file index action controls before the collapse chevron", () => {
    const actionIndex = source.indexOf("handleUpdateIndex(fileActionPaths)");
    const chevronIndex = source.indexOf("<ChevronDownIcon", actionIndex);

    expect(actionIndex).toBeGreaterThan(-1);
    expect(chevronIndex).toBeGreaterThan(actionIndex);
    expect(source).toContain("event.stopPropagation()");
  });

  it("normalizes file paths for per-file actions", () => {
    expect(source).toContain("normalizeDiffActionPath(fileDiff.prevName)");
    expect(source).toContain("normalizeDiffActionPath(fileDiff.name)");
    expect(source).toContain('pathValue === "/dev/null"');
    expect(source).toContain("return pathValue.slice(2)");
  });
});
