import { describe, it, expect } from "vitest";
import { parseFrontmatter } from "./parseFrontmatter";

describe("parseFrontmatter", () => {
  it("parses quoted and unquoted key/value pairs", () => {
    const raw = [
      "---",
      'title: "Hallo Welt"',
      "slug: hallo-welt",
      'description: "Ein Test mit: Doppelpunkt"',
      "---",
      "",
      "# Inhalt",
      "",
      "Erster Absatz.",
    ].join("\n");

    const { data, content } = parseFrontmatter(raw);

    expect(data).toEqual({
      title: "Hallo Welt",
      slug: "hallo-welt",
      description: "Ein Test mit: Doppelpunkt",
    });
    expect(content).toBe("# Inhalt\n\nErster Absatz.");
  });

  it("returns empty data and the raw content when there is no frontmatter block", () => {
    const raw = "# Kein Frontmatter\n\nNur Inhalt.";

    const { data, content } = parseFrontmatter(raw);

    expect(data).toEqual({});
    expect(content).toBe(raw);
  });

  it("ignores blank lines and lines without a colon inside the frontmatter block", () => {
    const raw = ["---", "title: Test", "", "not-a-pair", "---", "Body text"].join("\n");

    const { data, content } = parseFrontmatter(raw);

    expect(data).toEqual({ title: "Test" });
    expect(content).toBe("Body text");
  });

  it("handles single-quoted values", () => {
    const raw = ["---", "title: 'Single Quoted'", "---", "Body"].join("\n");

    const { data } = parseFrontmatter(raw);

    expect(data.title).toBe("Single Quoted");
  });
});
