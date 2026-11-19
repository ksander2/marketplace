import { describe, expect, it } from "vitest";
import { createEvent, testEventSchema } from "./events.js";

const correlationId = "018f3f2e-7d2f-7d5f-b1a4-5f0e8c6a2b10";

describe("event contracts", () => {
  it("creates a versioned event envelope", () => {
    const event = createEvent({
      type: "messaging.test.published",
      correlationId,
      payload: { message: "hello" },
    });

    expect(testEventSchema.parse(event)).toEqual(event);
    expect(event.version).toBe(1);
    expect(event.occurredAt).toBe(new Date(event.occurredAt).toISOString());
  });

  it("rejects an invalid payload", () => {
    const event = createEvent({
      type: "messaging.test.published",
      correlationId,
      payload: { message: "" },
    });

    expect(() => testEventSchema.parse(event)).toThrow();
  });
});
