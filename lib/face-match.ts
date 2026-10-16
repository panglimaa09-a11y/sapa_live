// Pencocokan wajah client-side (face-api.js).
// PRIVASI: semua pemrosesan terjadi di browser. Deskriptor wajah TIDAK PERNAH
// dikirim ke server — hanya skor kecocokan (angka) yang dilaporkan.
// Frame kamera live TIDAK di-upload / disimpan — diproses di memori lalu dibuang.

import * as faceapi from "@vladmandic/face-api";

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model";
const MATCH_THRESHOLD = 0.6; // jarak descriptor < 0.6 = wajah sama
const MIN_FACE_SIZE = 100; // px, tolak wajah terlalu kecil/jauh

let modelsLoaded = false;

export async function loadModels(): Promise<void> {
  if (modelsLoaded) return;
  await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
  await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
  await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
  modelsLoaded = true;
}

export type FaceResult =
  | { ok: true; descriptor: Float32Array; box: { width: number; height: number } }
  | { ok: false; reason: "NO_FACE" | "MULTIPLE_FACES" | "FACE_TOO_SMALL" };

/** Deteksi tepat SATU wajah yang cukup besar di elemen gambar/video. */
export async function detectSingleFace(
  input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
): Promise<FaceResult> {
  await loadModels();
  const detections = await faceapi
    .detectAllFaces(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptors();
  if (detections.length === 0) return { ok: false, reason: "NO_FACE" };
  if (detections.length > 1) return { ok: false, reason: "MULTIPLE_FACES" };
  const d = detections[0];
  if (d.detection.box.width < MIN_FACE_SIZE || d.detection.box.height < MIN_FACE_SIZE)
    return { ok: false, reason: "FACE_TOO_SMALL" };
  return {
    ok: true,
    descriptor: d.descriptor,
    box: { width: d.detection.box.width, height: d.detection.box.height },
  };
}

/** Jarak euclidean dua deskriptor. < MATCH_THRESHOLD berarti wajah sama. */
export function faceDistance(a: Float32Array, b: Float32Array): number {
  return faceapi.euclideanDistance(a, b);
}

export function isMatch(distance: number): boolean {
  return distance < MATCH_THRESHOLD;
}

/** Rasio keterbukaan mata dari landmarks (untuk deteksi kedip). */
function eyeAspectRatio(eye: faceapi.Point[]): number {
  const v1 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
  const v2 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
  const h = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
  return (v1 + v2) / (2 * h);
}

export type LivenessResult =
  | { ok: true }
  | { ok: false; reason: "NO_FACE" | "MULTIPLE_FACES" | "NO_BLINK" };

/**
 * Uji liveness: pantau video selama `durationMs`, anggap lolos jika terdeteksi
 * SATU wajah konsisten + minimal satu kedipan (mata menutup lalu membuka).
 * Menolak foto cetakan / layar yang diam.
 */
export async function checkLiveness(
  video: HTMLVideoElement,
  durationMs = 4000,
  onProgress?: (p: number) => void
): Promise<LivenessResult> {
  await loadModels();
  const start = Date.now();
  let blinked = false;
  let wasOpen = false;
  let framesWithFace = 0;
  let totalFrames = 0;

  while (Date.now() - start < durationMs) {
    totalFrames++;
    const det = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
      .withFaceLandmarks();
    if (!det) {
      await new Promise((r) => setTimeout(r, 120));
      onProgress?.(Math.min(1, (Date.now() - start) / durationMs));
      continue;
    }
    framesWithFace++;
    const lm = det.landmarks;
    const ear = (eyeAspectRatio(lm.getLeftEye()) + eyeAspectRatio(lm.getRightEye())) / 2;
    const eyesOpen = ear > 0.2;
    if (wasOpen && !eyesOpen) blinked = true; // transisi terbuka -> tertutup = kedip
    wasOpen = eyesOpen;
    onProgress?.(Math.min(1, (Date.now() - start) / durationMs));
    await new Promise((r) => setTimeout(r, 120));
  }

  if (framesWithFace < totalFrames * 0.5) return { ok: false, reason: "NO_FACE" };
  if (!blinked) return { ok: false, reason: "NO_BLINK" };
  return { ok: true };
}

/** Ambil frame video ke canvas (tidak di-upload ke mana pun). */
export function captureFrame(video: HTMLVideoElement): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = video.videoWidth;
  c.height = video.videoHeight;
  c.getContext("2d")!.drawImage(video, 0, 0);
  return c;
}
