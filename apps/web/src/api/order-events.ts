import { orderEventSchema, type OrderEvent } from "@marketplace/contracts/order";

interface StreamOrderEventsOptions {
  accessToken: string;
  signal: AbortSignal;
  onOpen: () => void;
  onEvent: (event: OrderEvent) => void;
}

export async function streamOrderEvents({
  accessToken,
  signal,
  onOpen,
  onEvent,
}: StreamOrderEventsOptions): Promise<void> {
  const response = await fetch("/api/events/orders", {
    headers: { authorization: `Bearer ${accessToken}` },
    signal,
  });
  if (!response.ok) {
    throw new Error(`SSE connection failed with status ${response.status}`);
  }
  if (!response.body) throw new Error("SSE response body is unavailable");

  onOpen();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });

      let separator = /\r?\n\r?\n/.exec(buffer);
      while (separator) {
        const block = buffer.slice(0, separator.index);
        buffer = buffer.slice(separator.index + separator[0].length);
        const event = parseEventBlock(block);
        if (event) onEvent(event);
        separator = /\r?\n\r?\n/.exec(buffer);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parseEventBlock(block: string): OrderEvent | null {
  let eventName = "";
  const data: string[] = [];

  for (const line of block.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) eventName = line.slice(6).trim();
    if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  if (data.length === 0) return null;

  const event = orderEventSchema.parse(JSON.parse(data.join("\n")));
  if (eventName && eventName !== event.type) {
    throw new Error("SSE event name does not match its payload");
  }
  return event;
}
