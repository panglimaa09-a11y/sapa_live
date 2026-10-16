"use client";

/**
 * Transport antrean matchmaking SapaLive.
 * - SupabaseLobbyTransport: via Supabase Realtime (presence + broadcast),
 *   untuk produksi. Tidak butuh tabel SQL tambahan.
 * - LoopbackLobbyTransport: via BroadcastChannel, demo antar-tab di
 *   perangkat yang sama tanpa server.
 * Presence membawa userId + displayName agar match tercatat di database.
 */

import { getSupabase } from "./supabase";
import { makeId } from "./signaling";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type {
  LobbyMsg,
  LobbyTransport,
  PresenceMeta,
} from "./matchmaking";

export function makePeerId(): string {
  return makeId();
}

export interface Identity {
  userId: string;
  displayName: string;
}

const CHANNEL = "sapalive-lobby";

export class SupabaseLobbyTransport implements LobbyTransport {
  readonly peerId = makePeerId();
  private identity: Identity;
  private channel: RealtimeChannel | null = null;
  private onMessage: ((m: LobbyMsg) => void) | null = null;
  private onPeersChanged: (() => void) | null = null;
  private joinedAt = Date.now();

  constructor(identity: Identity) {
    this.identity = identity;
  }

  private meta(status: "searching" | "busy"): PresenceMeta {
    return {
      peerId: this.peerId,
      userId: this.identity.userId,
      displayName: this.identity.displayName,
      status,
      ts: this.joinedAt,
    };
  }

  async start(
    onMessage: (m: LobbyMsg) => void,
    onPeersChanged: () => void
  ): Promise<void> {
    this.onMessage = onMessage;
    this.onPeersChanged = onPeersChanged;
    const sb = getSupabase();
    if (!sb) throw new Error("Supabase belum dikonfigurasi.");
    const ch = sb.channel(CHANNEL, {
      config: { presence: { key: this.peerId } },
    });
    this.channel = ch;
    ch.on("broadcast", { event: "lobby" }, ({ payload }) => {
      this.onMessage?.(payload as LobbyMsg);
    });
    ch.on("presence", { event: "sync" }, () => {
      this.onPeersChanged?.();
    });
    await ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void ch.track(this.meta("searching"));
        this.onPeersChanged?.();
      }
    });
  }

  peers(): PresenceMeta[] {
    const out: PresenceMeta[] = [];
    const state = this.channel?.presenceState<PresenceMeta>() ?? {};
    for (const [key, metas] of Object.entries(state)) {
      if (key === this.peerId) continue;
      const m = metas[metas.length - 1];
      if (m) out.push(m);
    }
    return out;
  }

  async setBusy(busy: boolean): Promise<void> {
    await this.channel?.track(this.meta(busy ? "busy" : "searching"));
  }

  async send(msg: LobbyMsg): Promise<void> {
    await this.channel?.send({
      type: "broadcast",
      event: "lobby",
      payload: msg,
    });
  }

  async stop(): Promise<void> {
    try {
      await this.channel?.untrack();
    } catch {
      /* abaikan */
    }
    const sb = getSupabase();
    if (this.channel && sb) {
      try {
        await sb.removeChannel(this.channel);
      } catch {
        /* abaikan */
      }
    }
    this.channel = null;
    this.onMessage = null;
    this.onPeersChanged = null;
  }
}

type LoopMsg =
  | { kind: "hello"; peerId: string; userId: string; displayName: string; ts: number }
  | { kind: "bye"; peerId: string }
  | { kind: "lobby"; msg: LobbyMsg };

const HEARTBEAT_MS = 2000;
const PEER_TTL_MS = 5000;

export class LoopbackLobbyTransport implements LobbyTransport {
  readonly peerId = makePeerId();
  private identity: Identity;
  private ch: BroadcastChannel | null = null;
  private peersMap = new Map<
    string,
    { userId: string; displayName: string; ts: number; lastSeen: number }
  >();
  private onMessage: ((m: LobbyMsg) => void) | null = null;
  private onPeersChanged: (() => void) | null = null;
  private hb: ReturnType<typeof setInterval> | null = null;
  private joinedAt = Date.now();

  constructor(identity: Identity) {
    this.identity = identity;
  }

  private hello(): LoopMsg {
    return {
      kind: "hello",
      peerId: this.peerId,
      userId: this.identity.userId,
      displayName: this.identity.displayName,
      ts: this.joinedAt,
    };
  }

  async start(
    onMessage: (m: LobbyMsg) => void,
    onPeersChanged: () => void
  ): Promise<void> {
    this.onMessage = onMessage;
    this.onPeersChanged = onPeersChanged;
    const ch = new BroadcastChannel(CHANNEL);
    this.ch = ch;
    ch.onmessage = (ev: MessageEvent<LoopMsg>) => {
      const d = ev.data;
      if (d.kind === "hello") {
        if (d.peerId === this.peerId) return;
        const isNew = !this.peersMap.has(d.peerId);
        this.peersMap.set(d.peerId, {
          userId: d.userId,
          displayName: d.displayName,
          ts: d.ts,
          lastSeen: Date.now(),
        });
        if (isNew) {
          ch.postMessage(this.hello());
          this.onPeersChanged?.();
        }
      } else if (d.kind === "bye") {
        if (this.peersMap.delete(d.peerId)) this.onPeersChanged?.();
      } else if (d.kind === "lobby") {
        this.onMessage?.(d.msg);
      }
    };
    ch.postMessage(this.hello());
    this.hb = setInterval(() => {
      this.ch?.postMessage(this.hello());
      let changed = false;
      const now = Date.now();
      for (const [k, v] of this.peersMap) {
        if (now - v.lastSeen > PEER_TTL_MS) {
          this.peersMap.delete(k);
          changed = true;
        }
      }
      if (changed) this.onPeersChanged?.();
    }, HEARTBEAT_MS);
  }

  peers(): PresenceMeta[] {
    return [...this.peersMap.entries()].map(([peerId, v]) => ({
      peerId,
      userId: v.userId,
      displayName: v.displayName,
      status: "searching" as const,
      ts: v.ts,
    }));
  }

  async setBusy(): Promise<void> {
    // Mode loopback: keluar lobby saat match (stop() mengirim bye).
  }

  async send(msg: LobbyMsg): Promise<void> {
    this.ch?.postMessage({ kind: "lobby", msg } satisfies LoopMsg);
  }

  async stop(): Promise<void> {
    if (this.hb) clearInterval(this.hb);
    this.hb = null;
    this.ch?.postMessage({ kind: "bye", peerId: this.peerId } satisfies LoopMsg);
    this.ch?.close();
    this.ch = null;
    this.peersMap.clear();
    this.onMessage = null;
    this.onPeersChanged = null;
  }
}
