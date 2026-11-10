// Copies MediaPipe WASM files and downloads the pose model so the app runs offline.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const wasmSrc = resolve(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const wasmDst = resolve(root, 'public/mediapipe/wasm');
if (existsSync(wasmSrc)) {
  mkdirSync(wasmDst, { recursive: true });
  cpSync(wasmSrc, wasmDst, { recursive: true });
  console.log('[setup] MediaPipe wasm copied');
}

const modelDst = resolve(root, 'public/mediapipe/pose_landmarker_lite.task');
if (!existsSync(modelDst)) {
  const url = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.statusText);
    mkdirSync(resolve(root, 'public/mediapipe'), { recursive: true });
    writeFileSync(modelDst, Buffer.from(await res.arrayBuffer()));
    console.log('[setup] pose model downloaded');
  } catch (e) {
    console.warn('[setup] could not download model, app will fall back to CDN:', e.message);
  }
}
