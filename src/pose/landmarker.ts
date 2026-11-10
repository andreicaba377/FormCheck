import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

let instance: Promise<PoseLandmarker> | null = null;

const CDN_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm';
const CDN_MODEL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';

async function localAvailable(): Promise<boolean> {
  try {
    const r = await fetch('/mediapipe/pose_landmarker_lite.task', { method: 'HEAD' });
    const type = r.headers.get('content-type') ?? '';
    return r.ok && !type.includes('text/html');
  } catch {
    return false;
  }
}

export function loadLandmarker(): Promise<PoseLandmarker> {
  if (!instance) {
    instance = (async () => {
      const local = await localAvailable();
      const fileset = await FilesetResolver.forVisionTasks(local ? '/mediapipe/wasm' : CDN_WASM);
      const modelAssetPath = local ? '/mediapipe/pose_landmarker_lite.task' : CDN_MODEL;
      const make = (delegate: 'GPU' | 'CPU') =>
        PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath, delegate },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      try {
        return await make('GPU');
      } catch {
        return await make('CPU');
      }
    })();
    instance.catch(() => (instance = null));
  }
  return instance;
}
