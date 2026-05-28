import { describe, expect, it } from "vitest";
import { askWithRag } from "doc-rag";

describe("doc-rag workspace dependency", () => {
  it("exposes the shared RAG entrypoint through the package boundary", () => {
    expect(typeof askWithRag).toBe("function");
  });
});
