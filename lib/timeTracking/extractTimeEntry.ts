import Anthropic from "@anthropic-ai/sdk";

// Extracts a structured {hours, note} pair from a voice-transcribed note
// (issue #195). Deliberately much simpler than lib/quotes/generateLineItems.ts'
// quote-generation prompt: no line items, no pricing, no price-list context --
// just "how many hours, and what did you work on". The user always confirms
// the extracted fields in TimeEntryForm before saving, so a slightly-off
// extraction is a UX inconvenience, not a data-integrity risk.

export class TimeEntryExtractionError extends Error {}

const TIME_ENTRY_TOOL = {
  name: "submit_time_entry",
  description:
    "Submit the number of hours worked and a short note extracted from a tradesperson's spoken description of their work day.",
  input_schema: {
    type: "object" as const,
    properties: {
      hours: {
        type: "number" as const,
        description: "Number of hours worked, e.g. 3.5. Must be greater than 0 and at most 24.",
      },
      note: {
        type: "string" as const,
        description: "A short (one sentence) summary of what work was done.",
      },
    },
    required: ["hours", "note"],
  },
};

export type ExtractedTimeEntry = { hours: number; note: string };

export function buildTimeEntryExtractionPrompt(transcript: string): string {
  return `You are extracting a timesheet entry for a German Handwerker (tradesperson) from a short voice note they recorded at the end of a work session. Extract how many hours they worked and a short note summarizing the work. The transcript may be in German.

Transcript:
${transcript}`;
}

export function parseTimeEntryToolInput(input: unknown): ExtractedTimeEntry {
  if (typeof input !== "object" || input === null) {
    throw new TimeEntryExtractionError("Malformed tool input: not an object");
  }
  const { hours, note } = input as Record<string, unknown>;
  if (typeof hours !== "number" || !Number.isFinite(hours)) {
    throw new TimeEntryExtractionError("Malformed tool input: hours is not a finite number");
  }
  if (hours <= 0 || hours > 24) {
    throw new TimeEntryExtractionError("Extracted hours out of range (0, 24]");
  }
  if (typeof note !== "string" || note.trim().length === 0) {
    throw new TimeEntryExtractionError("Malformed tool input: note is missing or empty");
  }
  return { hours, note: note.trim() };
}

export async function extractTimeEntry(transcript: string): Promise<ExtractedTimeEntry> {
  if (transcript.trim().length === 0) {
    throw new TimeEntryExtractionError("Empty transcript");
  }

  const anthropic = new Anthropic();

  let response;
  try {
    response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 512,
      tools: [TIME_ENTRY_TOOL],
      tool_choice: { type: "tool", name: "submit_time_entry" },
      messages: [{ role: "user", content: buildTimeEntryExtractionPrompt(transcript) }],
    });
  } catch (err) {
    throw new TimeEntryExtractionError(`Anthropic API call failed: ${(err as Error).message}`, {
      cause: err,
    });
  }

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new TimeEntryExtractionError("AI response did not include tool use");
  }

  return parseTimeEntryToolInput(toolUse.input);
}
