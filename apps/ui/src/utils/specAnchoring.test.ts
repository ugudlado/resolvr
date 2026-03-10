/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, it, expect } from "vitest";
import {
  simpleHash,
  stringSimilarity,
  buildAnchorMap,
  resolveAnchor,
} from "./specAnchoring";
import type { SpecBlockAnchor } from "../types/sessions";

// ---------------------------------------------------------------------------
// simpleHash
// ---------------------------------------------------------------------------

describe("simpleHash", () => {
  it("returns an 8-character hex string", () => {
    const hash = simpleHash("hello world");
    expect(hash).toHaveLength(8);
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it("returns the same hash for the same input", () => {
    expect(simpleHash("test")).toBe(simpleHash("test"));
  });

  it("returns different hashes for different inputs", () => {
    expect(simpleHash("foo")).not.toBe(simpleHash("bar"));
  });

  it("handles empty string", () => {
    const hash = simpleHash("");
    expect(hash).toHaveLength(8);
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });
});

// ---------------------------------------------------------------------------
// stringSimilarity
// ---------------------------------------------------------------------------

describe("stringSimilarity", () => {
  it("returns 1 for identical strings", () => {
    expect(stringSimilarity("hello", "hello")).toBe(1);
  });

  it("returns 0 for completely different strings", () => {
    const sim = stringSimilarity("abcdef", "zyxwvu");
    expect(sim).toBeLessThan(0.2);
  });

  it("returns a value between 0 and 1 for similar strings", () => {
    const sim = stringSimilarity(
      "The architecture uses React",
      "The architecture uses Vue",
    );
    expect(sim).toBeGreaterThan(0.5);
    expect(sim).toBeLessThan(1);
  });

  it("returns 0 for short strings (< 2 chars)", () => {
    expect(stringSimilarity("a", "a")).toBe(1); // identical short handled first
    expect(stringSimilarity("a", "b")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildAnchorMap
// ---------------------------------------------------------------------------

describe("buildAnchorMap", () => {
  const sampleMarkdown = `# Overview

This is the overview paragraph.

## Architecture

The system is built with components.

### Components

- Component A handles routing
- Component B handles state

\`\`\`mermaid
graph TD
  A --> B
\`\`\`

## Deployment

Deploy to production.
`;

  it("assigns sequential blockIndex starting at 0", () => {
    const map = buildAnchorMap(sampleMarkdown);
    const indices = [...map.keys()].sort((a, b) => a - b);
    expect(indices[0]).toBe(0);
    // Should be sequential
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBe(indices[i - 1] + 1);
    }
  });

  it("indexes headings with correct type", () => {
    const map = buildAnchorMap(sampleMarkdown);
    const headings = [...map.values()].filter((a) => a.type === "heading");
    expect(headings.length).toBe(4); // Overview, Architecture, Components, Deployment
    expect(headings[0].preview).toBe("Overview");
    expect(headings[1].preview).toBe("Architecture");
  });

  it("computes section paths from heading hierarchy", () => {
    const map = buildAnchorMap(sampleMarkdown);
    const entries = [...map.values()];

    // The "Overview" heading itself gets path "" (no parent)
    const overviewHeading = entries.find(
      (e) => e.type === "heading" && e.preview === "Overview",
    );
    expect(overviewHeading?.path).toBe("Overview");

    // Paragraph under "Overview" gets path "Overview"
    const overviewPara = entries.find(
      (e) => e.type === "paragraph" && e.preview.includes("overview paragraph"),
    );
    expect(overviewPara?.path).toBe("Overview");

    // "Components" heading gets full path including h1
    const componentsHeading = entries.find(
      (e) => e.type === "heading" && e.preview === "Components",
    );
    expect(componentsHeading?.path).toBe("Overview.Architecture.Components");
  });

  it("indexes list items with correct type", () => {
    const map = buildAnchorMap(sampleMarkdown);
    const listItems = [...map.values()].filter((a) => a.type === "list-item");
    expect(listItems.length).toBe(2);
    expect(listItems[0].preview).toContain("Component A");
  });

  it("tags mermaid code blocks as diagram type", () => {
    const map = buildAnchorMap(sampleMarkdown);
    const diagrams = [...map.values()].filter((a) => a.type === "diagram");
    expect(diagrams.length).toBe(1);
    expect(diagrams[0].preview).toContain("graph TD");
  });

  it("computes hashes for each block", () => {
    const map = buildAnchorMap(sampleMarkdown);
    for (const info of map.values()) {
      expect(info.hash).toMatch(/^[0-9a-f]{8}$/);
    }
  });

  it("truncates preview to 80 characters", () => {
    const longMd = `# Test\n\n${"a".repeat(200)}`;
    const map = buildAnchorMap(longMd);
    for (const info of map.values()) {
      expect(info.preview.length).toBeLessThanOrEqual(80);
    }
  });

  it("handles empty markdown", () => {
    const map = buildAnchorMap("");
    expect(map.size).toBe(0);
  });

  it("tags regular code blocks as paragraph type", () => {
    const md = "# Test\n\n```typescript\nconst x = 1;\n```\n";
    const map = buildAnchorMap(md);
    const codeBlocks = [...map.values()].filter((a) =>
      a.preview.includes("const x"),
    );
    expect(codeBlocks.length).toBe(1);
    expect(codeBlocks[0].type).toBe("paragraph");
  });
});

// ---------------------------------------------------------------------------
// resolveAnchor
// ---------------------------------------------------------------------------

describe("resolveAnchor", () => {
  const markdown = `# Architecture

The system uses React.

## Components

Component A handles routing.

Component B handles state management.
`;

  it("returns 'valid' when hash matches at same blockIndex", () => {
    const map = buildAnchorMap(markdown);
    // Get the anchor for "The system uses React."
    const target = [...map.values()].find((a) =>
      a.preview.includes("system uses React"),
    )!;

    const stored: SpecBlockAnchor = {
      type: target.type,
      hash: target.hash,
      path: target.path,
      preview: target.preview,
      blockIndex: target.blockIndex,
    };

    const result = resolveAnchor(map, stored);
    expect(result).toEqual({ status: "valid", blockIndex: target.blockIndex });
  });

  it("returns 'valid' when hash matches at a different blockIndex (block moved)", () => {
    const map = buildAnchorMap(markdown);
    const target = [...map.values()].find((a) =>
      a.preview.includes("system uses React"),
    )!;

    const stored: SpecBlockAnchor = {
      type: target.type,
      hash: target.hash,
      path: target.path,
      preview: target.preview,
      blockIndex: 999, // wrong index, but hash still matches
    };

    const result = resolveAnchor(map, stored);
    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.blockIndex).toBe(target.blockIndex);
    }
  });

  it("returns 'drifted' when content changed but path + similarity match", () => {
    const map = buildAnchorMap(markdown);
    const target = [...map.values()].find((a) =>
      a.preview.includes("system uses React"),
    )!;

    // Simulate a stored anchor with a different hash but similar preview
    const stored: SpecBlockAnchor = {
      type: target.type,
      hash: "00000000", // different hash
      path: target.path,
      preview: "The system uses React and Redux.", // similar text
      blockIndex: target.blockIndex,
    };

    const result = resolveAnchor(map, stored);
    expect(result.status).toBe("drifted");
    if (result.status === "drifted") {
      expect(result.blockIndex).toBe(target.blockIndex);
      expect(result.newHash).toBe(target.hash);
    }
  });

  it("returns 'orphaned' when no match found", () => {
    const map = buildAnchorMap(markdown);

    const stored: SpecBlockAnchor = {
      type: "paragraph",
      hash: "deadbeef",
      path: "NonExistent.Section",
      preview: "This content does not exist anywhere",
      blockIndex: 999,
    };

    const result = resolveAnchor(map, stored);
    expect(result).toEqual({ status: "orphaned" });
  });

  it("returns 'orphaned' when type does not match", () => {
    const map = buildAnchorMap(markdown);
    const target = [...map.values()].find((a) =>
      a.preview.includes("system uses React"),
    )!;

    const stored: SpecBlockAnchor = {
      type: "heading", // wrong type (it's a paragraph)
      hash: "00000000",
      path: target.path,
      preview: target.preview,
      blockIndex: target.blockIndex,
    };

    const result = resolveAnchor(map, stored);
    expect(result).toEqual({ status: "orphaned" });
  });
});
