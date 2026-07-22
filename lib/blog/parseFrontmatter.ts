export type Frontmatter = Record<string, string>;

export type ParsedMarkdown = {
  data: Frontmatter;
  content: string;
};

/**
 * Minimal, dependency-free YAML-frontmatter parser for our blog content.
 *
 * We only need a small, well-defined subset of YAML (flat `key: value`
 * pairs, values optionally wrapped in double quotes), so a hand-rolled
 * parser is simpler and lighter than pulling in a full YAML/frontmatter
 * library for 5 posts. Pure function: no filesystem access, easy to test.
 */
export function parseFrontmatter(raw: string): ParsedMarkdown {
  const trimmed = raw.replace(/^﻿/, "");
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(trimmed);

  if (!match) {
    return { data: {}, content: trimmed.trim() };
  }

  const [, frontmatterBlock, content] = match;
  const data: Frontmatter = {};

  for (const line of frontmatterBlock.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key) {
      data[key] = value;
    }
  }

  return { data, content: content.trim() };
}
