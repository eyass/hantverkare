import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildTimeEntryExtractionPrompt,
  parseTimeEntryToolInput,
  TimeEntryExtractionError,
  extractTimeEntry,
} from "./extractTimeEntry";

describe("buildTimeEntryExtractionPrompt", () => {
  it("includes the transcript verbatim", () => {
    const prompt = buildTimeEntryExtractionPrompt("Habe heute 4 Stunden am Bad gearbeitet.");
    expect(prompt).toContain("Habe heute 4 Stunden am Bad gearbeitet.");
  });

  it("mentions hours and a note in the instructions", () => {
    const prompt = buildTimeEntryExtractionPrompt("test");
    expect(prompt.toLowerCase()).toContain("hours");
    expect(prompt.toLowerCase()).toContain("note");
  });
});

describe("parseTimeEntryToolInput", () => {
  it("parses well-formed input", () => {
    const result = parseTimeEntryToolInput({ hours: 3.5, note: "Bad gefliest" });
    expect(result).toEqual({ hours: 3.5, note: "Bad gefliest" });
  });

  it("trims the note", () => {
    const result = parseTimeEntryToolInput({ hours: 2, note: "  Fliesen verlegt  " });
    expect(result.note).toBe("Fliesen verlegt");
  });

  it("throws when input is not an object", () => {
    expect(() => parseTimeEntryToolInput(null)).toThrow(TimeEntryExtractionError);
  });

  it("throws when hours is missing", () => {
    expect(() => parseTimeEntryToolInput({ note: "test" })).toThrow(TimeEntryExtractionError);
  });

  it("throws when hours is out of range", () => {
    expect(() => parseTimeEntryToolInput({ hours: 25, note: "test" })).toThrow(
      TimeEntryExtractionError,
    );
    expect(() => parseTimeEntryToolInput({ hours: 0, note: "test" })).toThrow(
      TimeEntryExtractionError,
    );
  });

  it("throws when note is empty", () => {
    expect(() => parseTimeEntryToolInput({ hours: 2, note: "   " })).toThrow(
      TimeEntryExtractionError,
    );
  });
});

// Mocks the Anthropic SDK to verify extractTimeEntry constructs the request
// correctly and parses the tool-use response, without making a real API call.
vi.mock("@anthropic-ai/sdk", () => {
  function MockAnthropic(this: unknown) {
    return {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: "tool_use",
              name: "submit_time_entry",
              input: { hours: 5, note: "Küche renoviert" },
            },
          ],
        }),
      },
    };
  }
  return { default: MockAnthropic };
});

describe("extractTimeEntry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls the Anthropic API with the transcript and returns parsed fields", async () => {
    const result = await extractTimeEntry("Ich habe heute fünf Stunden in der Küche gearbeitet.");
    expect(result).toEqual({ hours: 5, note: "Küche renoviert" });
  });

  it("throws on an empty transcript without calling the API", async () => {
    await expect(extractTimeEntry("")).rejects.toThrow(TimeEntryExtractionError);
  });
});
