import { describe, it, expect, vi } from "vitest";
import { isRetryableError, withRetry } from "../retry.js";

describe("isRetryableError", () => {
  it("returns true for 429 rate limit", () => {
    expect(isRetryableError(new Error("429 Too Many Requests"))).toBe(true);
  });

  it("returns true for 500 server error", () => {
    expect(isRetryableError(new Error("500 Internal Server Error"))).toBe(true);
  });

  it("returns true for 502 bad gateway", () => {
    expect(isRetryableError(new Error("502 Bad Gateway"))).toBe(true);
  });

  it("returns true for 503 service unavailable", () => {
    expect(isRetryableError(new Error("503 Service Unavailable"))).toBe(true);
  });

  it("returns true for timeout error", () => {
    expect(isRetryableError(new Error("Request timeout"))).toBe(true);
  });

  it("returns true for network error", () => {
    expect(isRetryableError(new Error("ETIMEDOUT"))).toBe(true);
    expect(isRetryableError(new Error("ECONNRESET"))).toBe(true);
    expect(isRetryableError(new Error("network error"))).toBe(true);
  });

  it("returns true for rate/overloaded keywords", () => {
    expect(isRetryableError(new Error("rate limit exceeded"))).toBe(true);
    expect(isRetryableError(new Error("server overloaded"))).toBe(true);
  });

  it("returns true for Anthropic overloaded_error", () => {
    expect(isRetryableError(new Error("overloaded_error"))).toBe(true);
  });

  it("returns true for Anthropic rate_limit_error", () => {
    expect(isRetryableError(new Error("rate_limit_error"))).toBe(true);
  });

  it("returns false for 401 unauthorized", () => {
    expect(isRetryableError(new Error("401 Unauthorized"))).toBe(false);
  });

  it("returns false for 402 payment required", () => {
    expect(isRetryableError(new Error("402 Payment Required"))).toBe(false);
  });

  it("returns false for 403 forbidden", () => {
    expect(isRetryableError(new Error("403 Forbidden"))).toBe(false);
  });

  it("returns false for non-HTTP errors without retryable keywords", () => {
    expect(isRetryableError(new Error("File not found"))).toBe(false);
    expect(isRetryableError(new Error("Invalid input"))).toBe(false);
  });
});

describe("withRetry", () => {
  it("returns result on first success without retrying", async () => {
    const fn = vi.fn().mockResolvedValue("success");
    const result = await withRetry(fn, "test", { verbose: false });
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on retryable error and succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("429 Too Many Requests"))
      .mockRejectedValueOnce(new Error("500 Server Error"))
      .mockResolvedValue("success");

    const result = await withRetry(fn, "test", { verbose: false, baseDelayMs: 1 });
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws immediately on non-retryable error", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("401 Unauthorized"));

    await expect(
      withRetry(fn, "test", { verbose: false, baseDelayMs: 1 }),
    ).rejects.toThrow("401 Unauthorized");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("gives up after maxRetries on retryable error", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("429 Too Many Requests"));

    await expect(
      withRetry(fn, "test", { maxRetries: 2, verbose: false, baseDelayMs: 1 }),
    ).rejects.toThrow("429 Too Many Requests");
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it("throws non-Error values as-is", async () => {
    const fn = vi.fn().mockRejectedValue("plain string error");

    await expect(
      withRetry(fn, "test", { verbose: false, baseDelayMs: 1 }),
    ).rejects.toBe("plain string error");
  });
});
