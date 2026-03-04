/**
 * Spec Anchoring — remark AST pre-pass for block indexing, content hashing,
 * section path computation, and drift detection.
 *
 * Builds an AnchorMap from a markdown string by walking the remark AST.
 * Each block-level node (paragraph, heading, list-item, code block) gets
 * a sequential blockIndex, a content hash, a section path from heading
 * hierarchy, and a preview string.
 *
 * Drift detection resolves a stored SpecBlockAnchor against a current
 * AnchorMap using a 3-tier fallback:
 *   1. Exact hash match at the same blockIndex -> valid
 *   2. Section path + 60% fuzzy similarity match -> drifted
 *   3. No match -> orphaned
 */

import { remark } from "remark";
import { visit } from "unist-util-visit";
import { toString } from "mdast-util-to-string";
import type { Root, Heading, Paragraph, ListItem, Code } from "mdast";
import type { SpecBlockAnchor } from "../types/sessions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AnchorBlockType = SpecBlockAnchor["type"];

export interface AnchorInfo {
  type: AnchorBlockType;
  /** First 8 hex chars of djb2 hash of the block text content. */
  hash: string;
  /** Dot-separated heading hierarchy, e.g. "Architecture.Components". */
  path: string;
  /** First 80 characters of text content, trimmed. */
  preview: string;
  /** Sequential 0-based position in the document. */
  blockIndex: number;
}

/** Map from blockIndex to AnchorInfo. */
export type AnchorMap = Map<number, AnchorInfo>;

export type AnchorResolution =
  | { status: "valid"; blockIndex: number }
  | { status: "drifted"; blockIndex: number; newHash: string }
  | { status: "orphaned" };

// ---------------------------------------------------------------------------
// Simple hash (djb2)
// ---------------------------------------------------------------------------

/**
 * djb2-based string hash. Returns the first 8 hex characters.
 *
 * This is NOT cryptographic — it is used for cheap content-change detection.
 */
export function simpleHash(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    // hash * 33 + charCode
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  // Convert to unsigned 32-bit then to hex, pad to 8 chars
  const unsigned = hash >>> 0;
  return unsigned.toString(16).padStart(8, "0");
}

// ---------------------------------------------------------------------------
// String similarity (for drift detection)
// ---------------------------------------------------------------------------

/**
 * Compute a similarity ratio between two strings using bigram overlap
 * (Dice coefficient). Returns a value between 0 and 1.
 */
export function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigramsA = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const bigram = a.substring(i, i + 2);
    bigramsA.set(bigram, (bigramsA.get(bigram) ?? 0) + 1);
  }

  let intersectionSize = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bigram = b.substring(i, i + 2);
    const count = bigramsA.get(bigram);
    if (count && count > 0) {
      bigramsA.set(bigram, count - 1);
      intersectionSize++;
    }
  }

  return (2 * intersectionSize) / (a.length - 1 + (b.length - 1));
}

// ---------------------------------------------------------------------------
// Build anchor map
// ---------------------------------------------------------------------------

/**
 * Check if a code block is a diagram (mermaid, plantuml, etc.).
 */
function isDiagramCodeBlock(node: Code): boolean {
  const lang = (node.lang ?? "").toLowerCase();
  return ["mermaid", "plantuml", "dot", "graphviz", "d2"].includes(lang);
}

/**
 * Build an AnchorMap by parsing markdown and walking the remark AST.
 *
 * Block-level nodes that are indexed:
 * - Paragraphs
 * - Headings (also update the section path stack)
 * - List items
 * - Code blocks (tagged as "diagram" if mermaid/plantuml/etc., else "paragraph")
 */
export function buildAnchorMap(markdown: string): AnchorMap {
  const tree = remark().parse(markdown);
  const anchorMap: AnchorMap = new Map();

  // Heading stack: [depth, text] pairs for computing section path.
  // When we encounter a heading at depth N, we pop everything >= N.
  const headingStack: Array<{ depth: number; text: string }> = [];
  let blockIndex = 0;

  /**
   * Compute the current section path from the heading stack.
   * Returns dot-separated heading texts, e.g. "Architecture.Components".
   */
  function currentSectionPath(): string {
    return headingStack.map((h) => h.text).join(".");
  }

  /**
   * Process a single block-level node and add it to the anchor map.
   */
  function addAnchor(type: AnchorBlockType, text: string): void {
    const hash = simpleHash(text);
    const preview = text.slice(0, 80).trim();
    const path = currentSectionPath();
    const idx = blockIndex++;

    anchorMap.set(idx, { type, hash, path, preview, blockIndex: idx });
  }

  // Walk the AST using visit. We handle specific node types at the
  // top level of the document (not nested inside other blocks we index).
  // For list items, we do want to go inside lists.
  visitBlocks(tree, headingStack, addAnchor);

  return anchorMap;
}

/**
 * Walk the AST tree and call addAnchor for each block-level node we care about.
 * This handles the heading stack management for section path computation.
 */
function visitBlocks(
  tree: Root,
  headingStack: Array<{ depth: number; text: string }>,
  addAnchor: (type: AnchorBlockType, text: string) => void,
): void {
  visit(tree, (node) => {
    switch (node.type) {
      case "heading": {
        const heading = node as Heading;
        const text = toString(heading).trim();

        // Pop headings at same or deeper depth
        while (
          headingStack.length > 0 &&
          headingStack[headingStack.length - 1].depth >= heading.depth
        ) {
          headingStack.pop();
        }
        headingStack.push({ depth: heading.depth, text });

        addAnchor("heading", text);
        break;
      }

      case "paragraph": {
        const text = toString(node as Paragraph).trim();
        if (text.length > 0) {
          addAnchor("paragraph", text);
        }
        break;
      }

      case "listItem": {
        const text = toString(node as ListItem).trim();
        if (text.length > 0) {
          addAnchor("list-item", text);
        }
        // Skip children so we don't double-index nested paragraphs
        return "skip";
      }

      case "code": {
        const codeNode = node as Code;
        const text = codeNode.value.trim();
        if (text.length > 0) {
          const type = isDiagramCodeBlock(codeNode) ? "diagram" : "paragraph";
          addAnchor(type, text);
        }
        break;
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Resolve anchor (drift detection)
// ---------------------------------------------------------------------------

const FUZZY_THRESHOLD = 0.6;

/**
 * Resolve a stored SpecBlockAnchor against a current AnchorMap.
 *
 * 3-tier fallback:
 * 1. Exact hash match at the stored blockIndex -> "valid"
 * 2. Search by section path + fuzzy content match (>= 60%) -> "drifted"
 * 3. No match found -> "orphaned"
 */
export function resolveAnchor(
  anchorMap: AnchorMap,
  storedAnchor: SpecBlockAnchor,
): AnchorResolution {
  // Tier 1: Exact hash match at the same blockIndex
  const sameBlock = anchorMap.get(storedAnchor.blockIndex);
  if (sameBlock && sameBlock.hash === storedAnchor.hash) {
    return { status: "valid", blockIndex: storedAnchor.blockIndex };
  }

  // Tier 1b: Exact hash match anywhere in the document (block may have moved)
  for (const [idx, info] of anchorMap) {
    if (info.hash === storedAnchor.hash && info.type === storedAnchor.type) {
      return { status: "valid", blockIndex: idx };
    }
  }

  // Tier 2: Section path + fuzzy content match
  let bestMatch: {
    blockIndex: number;
    similarity: number;
    hash: string;
  } | null = null;

  for (const [idx, info] of anchorMap) {
    // Must be same type
    if (info.type !== storedAnchor.type) continue;

    // Must have matching section path (or both empty)
    if (info.path !== storedAnchor.path) continue;

    // Fuzzy-compare preview text
    const similarity = stringSimilarity(storedAnchor.preview, info.preview);

    if (
      similarity >= FUZZY_THRESHOLD &&
      (!bestMatch || similarity > bestMatch.similarity)
    ) {
      bestMatch = { blockIndex: idx, similarity, hash: info.hash };
    }
  }

  if (bestMatch) {
    return {
      status: "drifted",
      blockIndex: bestMatch.blockIndex,
      newHash: bestMatch.hash,
    };
  }

  // Tier 3: No match
  return { status: "orphaned" };
}
