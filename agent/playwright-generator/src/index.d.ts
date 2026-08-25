import type { RecordedEvent } from "@bug-agent/event-schema";
export class PlaywrightGenerator {
  generate(session: { pageUrl?: string }, events: RecordedEvent[]): string;
}
