"use client";

/**
 * Matchmaking acak ala OmeTV: pengguna masuk antrean ("lobby"),
 * dipasangkan dengan orang asing secara acak, lalu diberi roomId
 * WebRTC + peran caller/callee yang sudah ditentukan.
 *
 * Protokol klaim deterministik (tanpa server pusat):
 * - Setiap pencari menargetkan pencari TERTUA lain lalu mengirim
 *   pair-request.
 * - Jika dua klaim bertabrakan, klaim dari peerId yang LEBIH KECIL
 *   yang menang — kedua sisi menghitung aturan yang sama sehingga
 *   tidak pernah ada pasangan ganda.
 * - Tidak ada respons dalam 6 detik = target dianggap hilang, coba lagi.
 */

import { makeId } from "./signaling";

export interface PresenceMeta {
  peerId: string;
  userId: string;
  displayName: string;
  status: "searching" | "busy";
  ts: number;
}

export interface MatchedPeer {
  peerId: string;
  userId: string;
  displayName: string;
}

export type LobbyMsg =
  | { kind: "pair-request"; from: string; to: string; roomId: string }
  | { kind: "pair-accept"; from: string; to: string; roomId: string }
  | { kind: "pair-reject"; from: string; to: string };

export interface LobbyTransport {
  readonly peerId: string;
  start(
    onMessage: (m: LobbyMsg) => void,
    onPeersChanged: () => void
  ): Promise<void>;
  peers(): PresenceMeta[];
  setBusy(busy: boolean): Promise<void>;
  send(msg: LobbyMsg): Promise<void>;
  stop(): Promise<void>;
}

const CLAIM_TIMEOUT_MS = 6000;

export class RandomMatcher {
  private transport: LobbyTransport;
  private onMatched: ((roomId: string, asCaller: boolean, peer: MatchedPeer) => void) | null =
    null;
  private pending: {
    target: string;
    roomId: string;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;
  private matched = false;
  private blockedIds: Set<string>;

  constructor(transport: LobbyTransport, opts?: { blockedIds?: Set<string> }) {
    this.transport = transport;
    this.blockedIds = opts?.blockedIds ?? new Set();
  }

  get peerId() {
    return this.transport.peerId;
  }

  /** Masuk antrean. onMatched dipanggil tepat sekali saat pasangan ketemu. */
  async startSearch(
    onMatched: (roomId: string, asCaller: boolean, peer: MatchedPeer) => void
  ): Promise<void> {
    this.onMatched = onMatched;
    this.matched = false;
    await this.transport.start(
      (m) => void this.handleMessage(m),
      () => void this.tryPair()
    );
    await this.tryPair();
  }

  private cancelPending() {
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending = null;
    }
  }

  private async tryPair() {
    if (this.matched || this.pending) return;
    const others = this.transport
      .peers()
      .filter(
        (p) => p.status === "searching" && !this.blockedIds.has(p.userId)
      );
    if (others.length === 0) return;
    // Tertua dulu (adil); tie-break deterministik via peerId.
    others.sort(
      (a, b) => a.ts - b.ts || (a.peerId < b.peerId ? -1 : 1)
    );
    await this.claim(others[0].peerId);
  }

  private async claim(target: string) {
    if (this.matched || this.pending) return;
    const roomId = makeId();
    this.pending = {
      target,
      roomId,
      timer: setTimeout(() => {
        this.pending = null;
        void this.tryPair();
      }, CLAIM_TIMEOUT_MS),
    };
    await this.transport.send({
      kind: "pair-request",
      from: this.transport.peerId,
      to: target,
      roomId,
    });
  }

  private peerMeta(peerId: string): MatchedPeer {
    const found = this.transport.peers().find((p) => p.peerId === peerId);
    return {
      peerId,
      userId: found?.userId ?? "",
      displayName: found?.displayName ?? "?",
    };
  }

  private async handleMessage(m: LobbyMsg) {
    const me = this.transport.peerId;
    if (m.to !== me || m.from === me || this.matched) return;

    if (m.kind === "pair-request") {
      if (m.from < me) {
        // Klaim dia menang deterministik → saya jadi callee.
        this.cancelPending();
        this.matched = true;
        const peer = this.peerMeta(m.from);
        await this.transport.setBusy(true);
        await this.transport.send({
          kind: "pair-accept",
          from: me,
          to: m.from,
          roomId: m.roomId,
        });
        this.onMatched?.(m.roomId, false, peer);
      } else {
        // Klaim saya yang menang → tolak, lalu klaim balik.
        await this.transport.send({
          kind: "pair-reject",
          from: me,
          to: m.from,
        });
        if (!this.pending) await this.claim(m.from);
      }
    } else if (m.kind === "pair-accept") {
      if (this.pending && this.pending.target === m.from) {
        const roomId = this.pending.roomId;
        const peer = this.peerMeta(m.from);
        this.cancelPending();
        this.matched = true;
        await this.transport.setBusy(true);
        this.onMatched?.(roomId, true, peer);
      }
    } else if (m.kind === "pair-reject") {
      if (this.pending && this.pending.target === m.from) {
        this.cancelPending();
        // Beri jeda agar presence sempat sinkron, lalu coba target lain.
        setTimeout(() => void this.tryPair(), 800);
      }
    }
  }

  /** Keluar dari antrean (dipanggil setelah match atau saat batal). */
  async stop() {
    this.cancelPending();
    this.matched = false;
    this.onMatched = null;
    await this.transport.stop();
  }

  /** Jumlah orang lain yang sedang mencari (untuk tampilan antrean). */
  waitingCount(): number {
    try {
      return this.transport
        .peers()
        .filter((p) => p.status === "searching").length;
    } catch {
      return 0;
    }
  }
}
