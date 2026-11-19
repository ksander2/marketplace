import { describe, expect, it } from "vitest";
import { baseConfigSchema, loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("applies defaults", () => {
    expect(loadConfig(baseConfigSchema, {})).toEqual({
      NODE_ENV: "development",
      LOG_LEVEL: "info",
      PORT: 3000,
    });
  });

  it("validates environment values", () => {
    expect(() => loadConfig(baseConfigSchema, { PORT: "invalid" })).toThrow();
  });
});
