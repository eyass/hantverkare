// AI-drafted follow-up nudge copy for stalled quotes (issue #158). Mirrors
// lib/quotes/generateLineItems.ts's tool-call pattern exactly (same
// tool_choice-forced single-tool-use shape) so the two AI integrations stay
// consistent, but asks for a short customer-facing follow-up message instead
// of structured line items.

import Anthropic from "@anthropic-ai/sdk";

export class FollowupGenerationError extends Error {}

const FOLLOWUP_MESSAGE_TOOL = {
  name: "submit_followup_message",
  description: "Submit the drafted follow-up message to send to the customer.",
  input_schema: {
    type: "object" as const,
    properties: {
      message: { type: "string" as const },
    },
    required: ["message"],
  },
};

export function parseFollowupMessageToolInput(input: unknown): string {
  if (
    typeof input !== "object" ||
    input === null ||
    !("message" in input) ||
    typeof (input as { message: unknown }).message !== "string"
  ) {
    throw new FollowupGenerationError("Malformed tool input: missing message string");
  }
  const message = (input as { message: string }).message.trim();
  if (message.length === 0) {
    throw new FollowupGenerationError("AI returned an empty message");
  }
  return message;
}

function buildPrompt(customerDescription: string, daysSinceSent: number): string {
  return `You are a German Handwerker (tradesperson) writing a short, friendly follow-up message to a customer about a quote you sent them ${daysSinceSent} days ago that they have not yet signed or declined.

Write the message in German. Keep it warm, brief (2-4 sentences), and low-pressure -- gently check in, offer to answer questions, and invite them to sign if they're ready. Do not sound pushy or salesy. Do not include a greeting salutation placeholder like "Sehr geehrte/r Kunde/Kundin" -- write it so it can be sent as-is.

Job description on the quote:
${customerDescription}`;
}

/**
 * Drafts a follow-up nudge message for a stalled quote using the same
 * Anthropic tool-use integration as quote line-item generation. Returns the
 * drafted message text; callers (the follow-up server action) are
 * responsible for letting the tradesperson review/edit before sending.
 */
export async function generateFollowupMessage(
  customerDescription: string,
  daysSinceSent: number,
): Promise<string> {
  const anthropic = new Anthropic();

  let response;
  try {
    response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 512,
      tools: [FOLLOWUP_MESSAGE_TOOL],
      tool_choice: { type: "tool", name: "submit_followup_message" },
      messages: [{ role: "user", content: buildPrompt(customerDescription, daysSinceSent) }],
    });
  } catch (err) {
    throw new FollowupGenerationError(`Anthropic API call failed: ${(err as Error).message}`, {
      cause: err,
    });
  }

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new FollowupGenerationError("AI response did not include tool use");
  }

  return parseFollowupMessageToolInput(toolUse.input);
}
