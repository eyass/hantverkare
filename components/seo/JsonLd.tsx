/**
 * Renders a JSON-LD <script> tag for structured data.
 * Server component only — do not add "use client".
 */
export function JsonLd({ schema }: { schema: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
