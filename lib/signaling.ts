"use client";

/**
 * Lapisan signaling untuk WebRTC.
 * - LoopbackSignaling: via BroadcastChannel, demo antar-tab tanpa server.
 * - SupabaseSignaling: via Supabase Realtime, untuk produksi (butuh env).
 */

export type SignalPayload =
  | { kind: "join"; from: string }
  | { kind: "offer"; from: string; sdp: RTCSessionDescriptionInit }
  | { kind: "answer"; from: string; sdp: RTCSessionDescriptionInit }
  | { kind: "ice"; from: string; candidate: RTCIceCandidateInit }
  | { kind: "leave"; from: string };

export interface Signaling {
  connect(roomId: string, onMessage: (m: SignalPayload) => void): Promise<void>;
  send(msg: SignalPayload): Promise<void>;
  disconnect(): Promise<void>;
}

export function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Signaling tanpa server: dua tab di perangkat yang sama. */
export class LoopbackSignaling implements Signaling {
  private ch: BroadcastChannel | null = null;
  private handler: ((m: SignalPayload) => void) | null = null;

  async connect(roomId: string, onMessage: (m: SignalPayload) => void) {
    this.handler = onMessage;
    this.ch = new BroadcastChannel(`sapa-room-${roomId}`);
    this.ch.onmessage = (ev: MessageEvent<SignalPayload>) => {
      this.handler?.(ev.data);
    };
  }

  async send(msg: SignalPayload) {
    this.ch?.postMessage(msg);
  }

  async disconnect() {
    this.ch?.close();
    this.ch = null;
    this.handler = null;
  }
}

/** Signaling produksi via Supabase Realtime. Aktif jika env terisi. */
export class SupabaseSignaling implements Signaling {
  private channel: { unsubscribe: () => void } | null = null;

  async connect(roomId: string, onMessage: (m: SignalPayload) => void) {
    const { getSupabase } = await import("./supabase");
    const sb = getSupabase();
    if (!sb) {
      throw new Error(
        "Supabase belum dikonfigurasi. Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY."
      );
    }
    const ch = sb.channel(`room-${roomId}`);
    ch.on("broadcast", { event: "signal" }, ({ payload }) =>
      onMessage(payload as SignalPayload)
    );
    await ch.subscribe();
    this.channel = { unsubscribe: () => sb.removeChannel(ch) };
    this.sendRef = (msg: SignalPayload) => {
      ch.send({ type: "broadcast", event: "signal", payload: msg });
    };
  }

  private sendRef: ((m: SignalPayload) => void) | null = null;

  async send(msg: SignalPayload) {
    this.sendRef?.(msg);
  }

  async disconnect() {
    this.channel?.unsubscribe();
    this.channel = null;
    this.sendRef = null;
  }
}
