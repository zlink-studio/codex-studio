import { describe, expect, it } from "vitest";

import { nextWorkMode, titleForPendingWorkMode, workModeMetaList } from "./work-mode-meta";

describe("work mode metadata", () => {
  it("orders issue work modes as auto, planning, ask, then discussion", () => {
    expect(workModeMetaList().map((mode) => mode.value)).toEqual(["standard", "planning", "ask", "discussion"]);
    expect(workModeMetaList().map((mode) => mode.label)).toEqual(["Auto mode", "Plan mode", "Ask mode", "日常沟通"]);
  });

  it("cycles issue work modes through execution and discussion", () => {
    expect(nextWorkMode("standard")).toBe("planning");
    expect(nextWorkMode("planning")).toBe("ask");
    expect(nextWorkMode("ask")).toBe("discussion");
    expect(nextWorkMode("discussion")).toBe("standard");
  });

  it("uses graduated tooltip copy", () => {
    expect(titleForPendingWorkMode("standard")).toBe("Auto mode for this submission. Click to change.");
    expect(titleForPendingWorkMode("planning")).toBe("Plan mode is on for this submission. Click to change.");
  });
});
