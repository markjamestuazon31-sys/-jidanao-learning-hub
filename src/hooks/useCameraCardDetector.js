import { useCallback, useEffect, useRef, useState } from "react";
import { CAMERA_CARD_COLORS } from "../utils/gameEngine";

function colorDistance(a, b) {
  return Math.sqrt(
    (a[0] - b[0]) ** 2 +
      (a[1] - b[1]) ** 2 +
      (a[2] - b[2]) ** 2,
  );
}

function dominantCenterColor(video, canvas) {
  const width = 160;
  const height = 120;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(video, 0, 0, width, height);
  const sampleWidth = 70;
  const sampleHeight = 60;
  const startX = Math.floor((width - sampleWidth) / 2);
  const startY = Math.floor((height - sampleHeight) / 2);
  const { data } = context.getImageData(startX, startY, sampleWidth, sampleHeight);
  let red = 0;
  let green = 0;
  let blue = 0;
  let weight = 0;

  for (let index = 0; index < data.length; index += 16) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const saturation = Math.max(r, g, b) - Math.min(r, g, b);
    if (saturation < 35 || Math.max(r, g, b) < 60) continue;
    red += r;
    green += g;
    blue += b;
    weight += 1;
  }

  if (weight < 30) return null;
  return [red / weight, green / weight, blue / weight];
}

export default function useCameraCardDetector({ cards = [], onDetected }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const canvasRef = useRef(document.createElement("canvas"));
  const stableRef = useRef({ id: null, frames: 0, acceptedAt: 0 });
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState("Camera is off.");
  const [confidence, setConfidence] = useState(0);
  const [detectedCard, setDetectedCard] = useState(null);

  const stop = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    stableRef.current = { id: null, frames: 0, acceptedAt: 0 };
    setActive(false);
    setStatus("Camera is off.");
    setConfidence(0);
    setDetectedCard(null);
  }, []);

  const analyze = useCallback(function analyzeFrame() {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !streamRef.current) {
      frameRef.current = requestAnimationFrame(analyzeFrame);
      return;
    }

    const rgb = dominantCenterColor(video, canvasRef.current);
    if (!rgb) {
      stableRef.current = { id: null, frames: 0, acceptedAt: stableRef.current.acceptedAt };
      setStatus("Place one colored number card inside the guide.");
      setConfidence(0);
      frameRef.current = requestAnimationFrame(analyzeFrame);
      return;
    }

    const palette = cards.length ? cards : CAMERA_CARD_COLORS;
    const ranked = palette
      .map((card) => ({ card, distance: colorDistance(rgb, card.rgb) }))
      .sort((a, b) => a.distance - b.distance);
    const match = ranked[0];
    const nextConfidence = Math.max(0, Math.min(100, Math.round(100 - match.distance / 2.2)));

    if (match.distance > 125) {
      stableRef.current = { id: null, frames: 0, acceptedAt: stableRef.current.acceptedAt };
      setStatus("Move the card closer and keep it inside the center guide.");
      setConfidence(nextConfidence);
      frameRef.current = requestAnimationFrame(analyzeFrame);
      return;
    }

    const stable = stableRef.current;
    if (stable.id === match.card.id) stable.frames += 1;
    else {
      stable.id = match.card.id;
      stable.frames = 1;
    }
    setDetectedCard(match.card);
    setConfidence(nextConfidence);
    setStatus(`Detecting ${match.card.label} card… hold still.`);

    if (stable.frames >= 18 && Date.now() - stable.acceptedAt > 1800) {
      stable.acceptedAt = Date.now();
      stable.frames = 0;
      setStatus(`${match.card.label} card detected.`);
      onDetected?.(match.card);
    }

    frameRef.current = requestAnimationFrame(analyzeFrame);
  }, [cards, onDetected]);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera access requires a supported browser and HTTPS or localhost.");
    }
    stop();
    setStatus("Requesting camera permission…");
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }
    setActive(true);
    setStatus("Place one colored number card inside the guide.");
    frameRef.current = requestAnimationFrame(analyze);
  }, [analyze, stop]);

  useEffect(() => stop, [stop]);

  return {
    videoRef,
    active,
    status,
    confidence,
    detectedCard,
    start,
    stop,
  };
}
