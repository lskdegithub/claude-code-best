import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  getConfiguredContextWindowSize,
  getEffectiveContextWindowSize,
  getAutoCompactThreshold,
} from "../../services/compact/autoCompact";
import {
  getContextWindowForModel,
  getRawContextWindowForModel,
} from "../context";

const MODEL = "claude-3-5-sonnet-20241022";
const ENV_KEYS = [
  "USER_TYPE",
  "CLAUDE_CODE_MAX_CONTEXT_TOKENS",
  "CLAUDE_CODE_AUTO_COMPACT_WINDOW",
  "CLAUDE_CODE_MAX_OUTPUT_TOKENS",
] as const;

describe("context window display sizing", () => {
  const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string>> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = savedEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  test("separates raw, configured, and usable windows", () => {
    process.env.USER_TYPE = "ant";
    process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW = "49000";
    process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS = "4096";

    expect(getRawContextWindowForModel(MODEL)).toBe(200000);
    expect(getContextWindowForModel(MODEL)).toBe(200000);
    expect(getConfiguredContextWindowSize(MODEL)).toBe(49000);
    expect(getEffectiveContextWindowSize(MODEL)).toBe(44904);
  });

  test("keeps raw model metadata when max context is overridden", () => {
    process.env.USER_TYPE = "ant";
    process.env.CLAUDE_CODE_MAX_CONTEXT_TOKENS = "64000";
    process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW = "49000";
    process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS = "4096";

    expect(getRawContextWindowForModel(MODEL)).toBe(200000);
    expect(getContextWindowForModel(MODEL)).toBe(64000);
    expect(getConfiguredContextWindowSize(MODEL)).toBe(49000);
    expect(getEffectiveContextWindowSize(MODEL)).toBe(44904);
  });
});

describe("third-party model context windows", () => {
  const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string>> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = savedEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  test("MiniMax-M2.5 uses correct context window", () => {
    expect(getContextWindowForModel("MiniMax-M2.5")).toBe(65536);
    expect(getContextWindowForModel("miniMax-M2.5")).toBe(65536);
    // Partial match
    expect(getContextWindowForModel("MiniMax-M2.5-8k")).toBe(65536);
  });

  test("MiniMax-M2 uses correct context window", () => {
    expect(getContextWindowForModel("MiniMax-M2")).toBe(100000);
    expect(getContextWindowForModel("miniMax-M2")).toBe(100000);
  });

  test("Grok models use correct context window", () => {
    expect(getContextWindowForModel("grok-2")).toBe(131072);
    expect(getContextWindowForModel("grok-2-vision-1212")).toBe(131072);
    expect(getContextWindowForModel("grok-beta")).toBe(131072);
  });

  test("MiniMax-M2.5 auto-compact threshold is correct", () => {
    // effectiveContextWindow = 65536 - 20000 = 45536
    // autocompactThreshold = 45536 - 13000 = 32536
    expect(getEffectiveContextWindowSize("MiniMax-M2.5")).toBe(45536);
    expect(getAutoCompactThreshold("MiniMax-M2.5")).toBe(32536);
  });
});
