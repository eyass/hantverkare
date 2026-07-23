import { describe, it, expect } from "vitest";
import { buildClarifyingQuestionsUpdate, buildResolvedTimestamp } from "./clarifyingQuestions";

describe("buildClarifyingQuestionsUpdate", () => {
  it("stores the new open questions and clears resolution when the regenerated draft still has questions", () => {
    const now = new Date("2026-07-23T10:00:00.000Z");
    const result = buildClarifyingQuestionsUpdate(["Wie viele Quadratmeter?"], now);
    expect(result).toEqual({
      ai_clarifying_questions: ["Wie viele Quadratmeter?"],
      ai_clarifying_questions_resolved_at: null,
    });
  });

  it("clears the questions and stamps the resolution when the regenerated draft has none", () => {
    const now = new Date("2026-07-23T10:00:00.000Z");
    const result = buildClarifyingQuestionsUpdate([], now);
    expect(result).toEqual({
      ai_clarifying_questions: null,
      ai_clarifying_questions_resolved_at: "2026-07-23T10:00:00.000Z",
    });
  });
});

describe("buildResolvedTimestamp", () => {
  it("stamps the current time as an ISO string, for the explicit skip action", () => {
    const now = new Date("2026-07-23T12:34:56.000Z");
    expect(buildResolvedTimestamp(now)).toBe("2026-07-23T12:34:56.000Z");
  });

  it("defaults to the current time when no clock is passed", () => {
    const before = Date.now();
    const stamped = new Date(buildResolvedTimestamp()).getTime();
    const after = Date.now();
    expect(stamped).toBeGreaterThanOrEqual(before);
    expect(stamped).toBeLessThanOrEqual(after);
  });
});
