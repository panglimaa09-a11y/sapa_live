// Verifikasi wajah kreator: kamera live -> liveness (kedip) -> cocokkan dengan foto profil.
// PRIVASI: wajah diproses 100% di browser. Yang dikirim ke server HANYA:
//   { match_score, liveness_passed, passed } — bukan foto, bukan data wajah.
// ANTI-CURANG: wajib kamera live (tidak bisa upload file), tolak jika tidak ada
// wajah / wajah lebih dari satu / wajah terlalu kecil / tidak berkedip.

"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle, WarningCircle, XCircle } from "@phosphor-icons/react";
import {
  loadModels,
  detectSingleFace,
  faceDistance,
  isMatch,
  checkLiveness,
  captureFrame,
} from "../../../../lib/face-match";

export type FaceVerifyResult = {
  passed: boolean;
  matchScore: number; // jarak descriptor, makin kecil makin mirip
  livenessPassed: boolean;
};

type Phase =
  | "idle"
  | "loading-models"
  | "camera"
  | "liveness"
  | "matching"
  | "done"
  | "error";

const REASON_TEXT: Record<string, string> = {
  NO_FACE: "Tidak terdeteksi wajah. Hadapkan wajah ke kamera.",
  MULTIPLE_FACES: "Terdeteksi lebih dari satu wajah. Pastikan hanya kamu sendiri.",
  FACE_TOO_SMALL: "Wajah terlalu kecil/jauh. Dekatkan wajah ke kamera.",
  NO_BLINK: "Tidak terdeteksi kedipan. Kedipkan mata saat verifikasi.",
  NO_PROFILE_FACE: "Foto profil tidak mengandung wajah yang jelas. Ganti foto profil dulu.",
  CAMERA_DENIED: "Akses kamera ditolak. Izinkan kamera untuk verifikasi.",
};

export default function FaceVerify({
  profilePhotoUrl,
  onResult,
}: {
  profilePhotoUrl: string | null;
  onResult: (r: FaceVerifyResult | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<FaceVerifyResult | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(() => stopCamera, []);

  const startCamera = async () => {
    setError("");
    setResult(null);
    onResult(null);
    setPhase("loading-models");
    try {
      await loadModels();
    } catch {
      setPhase("error");
      setError("Gagal memuat model wajah. Coba lagi.");
      return;
    }
    setPhase("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setPhase("error");
      setError(REASON_TEXT.CAMERA_DENIED);
    }
  };

  const runVerification = async () => {
    const video = videoRef.current;
    if (!video || !profilePhotoUrl) return;
    setError("");
    setPhase("liveness");
    setProgress(0);

    // 1. Liveness: wajib kedip dalam 4 detik
    const live = await checkLiveness(video, 4000, setProgress);
    if (!live.ok) {
      setPhase("error");
      setError(REASON_TEXT[live.reason]);
      return;
    }

    // 2. Ambil frame + deteksi wajah live
    setPhase("matching");
    const frame = captureFrame(video);
    const liveFace = await detectSingleFace(frame);
    if (!liveFace.ok) {
      setPhase("error");
      setError(REASON_TEXT[liveFace.reason]);
      return;
    }

    // 3. Deteksi wajah di foto profil
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = profilePhotoUrl;
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
    });
    const profileFace = await detectSingleFace(img);
    if (!profileFace.ok) {
      setPhase("error");
      setError(REASON_TEXT.NO_PROFILE_FACE);
      return;
    }

    // 4. Bandingkan
    const distance = faceDistance(profileFace.descriptor, liveFace.descriptor);
    const passed = isMatch(distance);
    const r: FaceVerifyResult = { passed, matchScore: Math.round(distance * 1000) / 1000, livenessPassed: true };
    setResult(r);
    onResult(r);
    setPhase("done");
    stopCamera();
  };

  const reset = () => {
    stopCamera();
    setPhase("idle");
    setResult(null);
    setError("");
    onResult(null);
  };

  return (
    <div className="rounded-2xl border-2 border-white/10 bg-base p-5">
      <h3 className="font-extrabold">Verifikasi Wajah</h3>
      <p className="mt-1 text-xs leading-relaxed text-ink-soft">
        Wajahmu difoto <b>langsung dari kamera</b> dan dicocokkan dengan foto profil. Tidak bisa
        pakai foto orang lain atau file upload. Data wajah <b>tidak dikirim ke server</b> — hanya
        skor kecocokan.
      </p>

      {phase === "idle" && !result && (
        <button
          type="button"
          onClick={startCamera}
          disabled={!profilePhotoUrl}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3.5 font-extrabold text-white disabled:opacity-40"
        >
          <Camera size={20} /> Mulai Verifikasi Wajah
        </button>
      )}
      {!profilePhotoUrl && (
        <p className="mt-2 text-xs font-bold text-amber-300">Upload foto profil dulu sebelum verifikasi.</p>
      )}

      {(phase === "camera" || phase === "liveness" || phase === "matching" || phase === "loading-models") && (
        <div className="mt-4">
          <div className="relative overflow-hidden rounded-2xl bg-black">
            <video ref={videoRef} playsInline muted className="h-64 w-full object-cover" />
            {phase !== "camera" && (
              <div className="absolute inset-x-0 bottom-0 bg-black/60 px-4 py-2 text-center text-xs font-bold text-white">
                {phase === "loading-models" && "Memuat model..."}
                {phase === "liveness" && `Kedipkan mata... ${Math.round(progress * 100)}%`}
                {phase === "matching" && "Mencocokkan wajah..."}
              </div>
            )}
          </div>
          {phase === "camera" && (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={runVerification}
                className="flex-1 rounded-2xl bg-accent px-4 py-3 font-extrabold text-white"
              >
                Ambil & Verifikasi
              </button>
              <button
                type="button"
                onClick={reset}
                className="rounded-2xl border-2 border-white/15 px-4 py-3 font-bold"
              >
                Batal
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <XCircle size={20} className="mt-0.5 shrink-0 text-red-300" />
          <div>
            <p className="text-sm font-bold text-red-200">{error}</p>
            <button type="button" onClick={reset} className="mt-2 text-xs font-extrabold text-red-300 underline">
              Coba lagi
            </button>
          </div>
        </div>
      )}

      {result && (
        <div
          className={`mt-4 flex items-start gap-2 rounded-2xl border px-4 py-3 ${
            result.passed ? "border-emerald-500/30 bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/10"
          }`}
        >
          {result.passed ? (
            <CheckCircle size={20} className="mt-0.5 shrink-0 text-emerald-300" />
          ) : (
            <WarningCircle size={20} className="mt-0.5 shrink-0 text-amber-300" />
          )}
          <div className="flex-1">
            <p className={`text-sm font-extrabold ${result.passed ? "text-emerald-200" : "text-amber-200"}`}>
              {result.passed ? "Wajah cocok dengan foto profil." : "Wajah TIDAK cocok dengan foto profil."}
            </p>
            <p className="mt-0.5 text-xs text-ink-soft">Skor kemiripan: {Math.max(0, Math.round((1 - result.matchScore) * 100))}%</p>
            {!result.passed && (
              <button type="button" onClick={reset} className="mt-2 text-xs font-extrabold underline">
                Coba lagi
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
