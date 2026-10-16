"use client";

import {
  LoopbackSignaling,
  SupabaseSignaling,
  makeId,
  type Signaling,
  type SignalPayload,
} from "./signaling";
import { supabaseConfigured } from "./supabase";

/**
 * Manajer panggilan WebRTC 1v1.
 * STUN publik gratis; untuk produksi di balik NAT simetris, tambahkan TURN
 * di RTC_CONFIG (lihat .env.example).
 */
export const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export type CallState =
  | "idle"
  | "need-media"
  | "lobby"
  | "waiting"
  | "connecting"
  | "connected"
  | "ended"
  | "error";

export class CallManager {
  private pc: RTCPeerConnection | null = null;
  private signaling: Signaling | null = null;
  private stream: MediaStream | null = null;
  private peerId = makeId();
  private isCaller = false;
  private roomId = "";
  private onState: (s: CallState, detail?: string) => void = () => {};
  private onRemoteStream: (s: MediaStream | null) => void = () => {};

  constructor(opts: {
    onState: (s: CallState, detail?: string) => void;
    onRemoteStream: (s: MediaStream | null) => void;
  }) {
    this.onState = opts.onState;
    this.onRemoteStream = opts.onRemoteStream;
  }

  private setState(s: CallState, detail?: string) {
    this.onState(s, detail);
  }

  async startLocalMedia(): Promise<MediaStream> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      });
      return this.stream;
    } catch {
      this.setState("error", "Izin kamera/mikrofon ditolak atau tidak tersedia.");
      throw new Error("media-denied");
    }
  }

  get localStream() {
    return this.stream;
  }

  /** Buat room baru sebagai penelepon (caller). */
  async createRoom(): Promise<string> {
    this.roomId = makeId();
    this.isCaller = true;
    await this.setupPeer(true);
    return this.roomId;
  }

  /** Gabung room yang sudah ada sebagai penerima (callee). */
  async joinRoom(roomId: string) {
    this.roomId = roomId.trim().toLowerCase();
    this.isCaller = false;
    await this.setupPeer(false);
  }

  /** Gabung room hasil matchmaking acak dengan peran yang ditentukan. */
  async joinMatchedRoom(roomId: string, asCaller: boolean) {
    this.roomId = roomId.trim().toLowerCase();
    this.isCaller = asCaller;
    await this.setupPeer(asCaller);
  }

  private async setupPeer(caller: boolean) {
    this.signaling = supabaseConfigured
      ? new SupabaseSignaling()
      : new LoopbackSignaling();
    await this.signaling.connect(this.roomId, (m) => this.handleSignal(m));

    this.pc = new RTCPeerConnection(RTC_CONFIG);
    this.stream?.getTracks().forEach((t) => this.pc!.addTrack(t, this.stream!));
    this.pc.ontrack = (ev) => this.onRemoteStream(ev.streams[0] ?? null);
    this.pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.signaling?.send({
          kind: "ice",
          from: this.peerId,
          candidate: ev.candidate.toJSON(),
        });
      }
    };
    this.pc.onconnectionstatechange = () => {
      const st = this.pc?.connectionState;
      if (st === "connected") this.setState("connected");
      if (st === "failed" || st === "disconnected") {
        this.setState("error", "Koneksi terputus. Coba lagi atau gunakan jaringan lain.");
      }
    };

    if (caller) {
      this.setState("waiting");
      // Caller menunggu "join" dari callee, lalu membuat offer.
    } else {
      this.setState("connecting");
      await this.signaling.send({ kind: "join", from: this.peerId });
    }
  }

  private async handleSignal(m: SignalPayload) {
    if (m.from === this.peerId || !this.pc) return;
    try {
      if (m.kind === "join" && this.isCaller) {
        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        await this.signaling?.send({
          kind: "offer",
          from: this.peerId,
          sdp: offer,
        });
      } else if (m.kind === "offer" && !this.isCaller) {
        await this.pc.setRemoteDescription(new RTCSessionDescription(m.sdp));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        await this.signaling?.send({
          kind: "answer",
          from: this.peerId,
          sdp: answer,
        });
      } else if (m.kind === "answer" && this.isCaller) {
        await this.pc.setRemoteDescription(new RTCSessionDescription(m.sdp));
      } else if (m.kind === "ice") {
        await this.pc.addIceCandidate(new RTCIceCandidate(m.candidate));
      } else if (m.kind === "leave") {
        this.setState("ended", "Lawan bicara mengakhiri panggilan.");
        this.cleanup();
      }
    } catch {
      this.setState("error", "Gagal menegosiasikan koneksi.");
    }
  }

  async hangup() {
    try {
      await this.signaling?.send({ kind: "leave", from: this.peerId });
    } catch {
      /* abaikan */
    }
    this.cleanup();
    this.setState("ended");
  }

  private cleanup() {
    this.pc?.close();
    this.pc = null;
    this.signaling?.disconnect();
    this.signaling = null;
    this.onRemoteStream(null);
  }

  destroy() {
    this.cleanup();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
