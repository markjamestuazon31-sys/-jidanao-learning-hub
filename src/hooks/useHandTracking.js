import { useCallback, useEffect, useRef, useState } from "react";

const EMPTY_HAND = Object.freeze({ cursor: null, landmarks: [], pinching: false, confidence: 0 });

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
}

function mirroredLandmarks(source) {
  return source.map((point) => ({ x: 1 - point.x, y: point.y, z: point.z || 0 }));
}

function handState(source, previousCursor, previousPinching) {
  if (!source?.length) return EMPTY_HAND;
  const landmarks = mirroredLandmarks(source);
  const indexTip = landmarks[8];
  const thumbTip = landmarks[4];
  const wrist = landmarks[0];
  const middleMcp = landmarks[9];
  const palmScale = Math.max(0.045, distance(wrist, middleMcp));
  const pinchRatio = distance(indexTip, thumbTip) / palmScale;
  // Wide hysteresis makes grabbing forgiving for younger hands while preventing
  // an accidental release when the fingers move during a drag.
  const pinching = previousPinching ? pinchRatio < 0.78 : pinchRatio < 0.58;
  const rawCursor = { x: indexTip.x, y: indexTip.y };
  const movement = previousCursor ? Math.hypot(rawCursor.x - previousCursor.x, rawCursor.y - previousCursor.y) : 1;
  const cursor = previousCursor
    ? movement < 0.004
      ? previousCursor
      : {
          x: previousCursor.x * 0.52 + rawCursor.x * 0.48,
          y: previousCursor.y * 0.52 + rawCursor.y * 0.48,
        }
    : rawCursor;
  return {
    cursor,
    landmarks,
    pinching,
    confidence: Math.max(0, Math.min(100, Math.round((1 - Math.min(1, pinchRatio)) * 100))),
  };
}

export default function useHandTracking() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const landmarkerRef = useRef(null);
  const frameRef = useRef(null);
  const lastInferenceRef = useRef(0);
  const lastVideoTimeRef = useRef(-1);
  const handRef = useRef(EMPTY_HAND);
  const [hand, setHand] = useState(EMPTY_HAND);
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Camera is off.");
  const [error, setError] = useState("");

  const stop = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    handRef.current = EMPTY_HAND;
    setHand(EMPTY_HAND);
    setActive(false);
    setLoading(false);
    setStatus("Camera is off.");
  }, []);

  const analyze = useCallback(function analyzeFrame() {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker || !streamRef.current) return;
    const now = performance.now();
    if (
      video.readyState >= 2
      && video.currentTime !== lastVideoTimeRef.current
      && now - lastInferenceRef.current >= 45
    ) {
      lastInferenceRef.current = now;
      lastVideoTimeRef.current = video.currentTime;
      try {
        const result = landmarker.detectForVideo(video, now);
        const next = handState(
          result.landmarks?.[0],
          handRef.current.cursor,
          handRef.current.pinching,
        );
        handRef.current = next;
        setHand(next);
        setStatus(next.cursor
          ? next.pinching
            ? "Pinch detected — keep holding while you drag."
            : "Hand found — move your fingertip to a number and pinch."
          : "Show one hand clearly inside the camera frame.");
      } catch (inferenceError) {
        console.warn("Hand tracking frame failed:", inferenceError);
      }
    }
    frameRef.current = requestAnimationFrame(analyzeFrame);
  }, []);

  const initialize = useCallback(async () => {
    if (landmarkerRef.current) return landmarkerRef.current;
    setStatus("Loading hand-tracking model…");
    const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
    const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
    const options = {
      baseOptions: { modelAssetPath: "/models/hand_landmarker.task", delegate: "GPU" },
      runningMode: "VIDEO",
      numHands: 1,
      minHandDetectionConfidence: 0.45,
      minHandPresenceConfidence: 0.45,
      minTrackingConfidence: 0.42,
    };
    try {
      landmarkerRef.current = await HandLandmarker.createFromOptions(vision, options);
    } catch (gpuError) {
      console.warn("GPU hand tracking unavailable; using CPU:", gpuError);
      landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
        ...options,
        baseOptions: { modelAssetPath: "/models/hand_landmarker.task", delegate: "CPU" },
      });
    }
    return landmarkerRef.current;
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Hand tracking requires a supported browser on HTTPS or localhost.");
    }
    stop();
    setLoading(true);
    setError("");
    try {
      await initialize();
      setStatus("Requesting camera permission…");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (!videoRef.current) throw new Error("Camera preview is not ready.");
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      lastInferenceRef.current = 0;
      lastVideoTimeRef.current = -1;
      setActive(true);
      setLoading(false);
      setStatus("Show one hand clearly inside the camera frame.");
      frameRef.current = requestAnimationFrame(analyze);
    } catch (startError) {
      stop();
      const message = startError?.name === "NotAllowedError"
        ? "Camera permission was blocked. Allow access or use Classic Mode."
        : startError?.message || "The camera could not be started.";
      setError(message);
      throw new Error(message);
    }
  }, [analyze, initialize, stop]);

  useEffect(() => () => {
    stop();
    landmarkerRef.current?.close?.();
    landmarkerRef.current = null;
  }, [stop]);

  return {
    videoRef,
    active,
    loading,
    status,
    error,
    cursor: hand.cursor,
    landmarks: hand.landmarks,
    pinching: hand.pinching,
    confidence: hand.confidence,
    start,
    stop,
  };
}
