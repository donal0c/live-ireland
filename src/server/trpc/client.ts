export type StreamStatus = "idle" | "connecting" | "active" | "error";

export type StreamConnection = {
  channel: string;
  status: StreamStatus;
  lastMessageAt: string | null;
};

export const createStreamConnection = (channel: string): StreamConnection => ({
  channel,
  status: "idle",
  lastMessageAt: null,
});
