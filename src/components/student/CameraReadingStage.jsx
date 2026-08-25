import {
  BookOpenCheck,
  Camera,
  CameraOff,
  CheckCircle2,
  Keyboard,
  Mic,
  MicOff,
  RotateCcw,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Volume2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import useSpeechRecognition from "../../hooks/useSpeechRecognition";
import { scoreReadingTranscript } from "../../utils/gameEngine";
import { useLearningPreferences } from "../../context/LearningPreferencesContext";

export default function CameraReadingStage({
  question,
  onCorrect,
  onSkip,
  onModel,
  beforeListen,
  language = "english",
  disabled = false,
  autoStart = true,
}) {
  const { playSound } = useLearningPreferences();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const autoAttemptedRef = useRef(false);
  const completedRef = useRef(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [typedText, setTypedText] = useState("");
  const [result, setResult] = useState(null);
  const [showTypedPractice, setShowTypedPractice] = useState(false);
  const [completed, setCompleted] = useState(false);
  const isFilipino = language === "filipino";
  const copy = isFilipino ? {
    title: "Tumingin, bumasa, at matuto",
    instruction: "Awtomatikong bubukas ang camera. Pindutin ang Basahin ngayon at basahin ang pangungusap sa natural na boses.",
    listening: "Nakikinig ako—basahin ang buong pangungusap",
    ready: "Handa na kapag ikaw ay handa",
    waiting: "Lalabas dito ang iyong mga salita habang nagbabasa.",
    success: "Mahusay na pagbasa",
    retry: "Magandang pagsubok",
    next: "Malinaw na nakilala ang pangungusap. Susunod na antas na.",
    model: "Pakinggan ang halimbawa",
    read: "Basahin ngayon",
    readAgain: "Subukang basahin muli",
    finish: "Tapusin ang pagbasa",
    typed: "Pagsasanay sa pag-type",
    typedLabel: "I-type ang pangungusap gaya ng ipinakita",
    typedPlaceholder: "I-type ang pangungusap…",
    check: "Suriin",
    skip: "Sanayin itong muli sa susunod at magpatuloy",
  } : {
    title: "Look, read, and grow",
    instruction: "The camera starts automatically. Press Read now, then read the passage in your natural voice.",
    listening: "I’m listening—read the full sentence",
    ready: "Ready when you are",
    waiting: "Your words will appear here while you read.",
    success: "Great reading",
    retry: "Good try",
    next: "The sentence was recognized clearly. Moving to the next stage.",
    model: "Hear an example",
    read: "Read now",
    readAgain: "Try reading again",
    finish: "Finish reading",
    typed: "Typed practice",
    typedLabel: "Type the sentence exactly as shown",
    typedPlaceholder: "Type the reading sentence…",
    check: "Check",
    skip: "Save this for more practice and continue",
  };

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    setCameraLoading(false);
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser cannot open the camera. You can continue with voice or typed reading practice.");
      return;
    }
    stopCamera();
    setCameraLoading(true);
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 960 },
          height: { ideal: 540 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (!videoRef.current) throw new Error("The reading camera preview is not ready.");
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraActive(true);
      setCameraLoading(false);
    } catch (error) {
      stopCamera();
      setCameraError(error?.name === "NotAllowedError"
        ? "Camera permission was blocked. Allow camera access, or continue with voice practice without video."
        : error?.message || "The camera could not start.");
    }
  }, [stopCamera]);

  const evaluateReading = useCallback(({ transcript, alternatives = [] }) => {
    if (disabled || completedRef.current || !question?.readingText) return;
    const candidates = [...new Set([transcript, ...alternatives].filter(Boolean))];
    const best = candidates
      .map((candidate) => ({ transcript: candidate, ...scoreReadingTranscript(question.readingText, candidate) }))
      .sort((left, right) => right.accuracy - left.accuracy)[0];
    if (!best) return;

    const passed = best.accuracy >= Number(question.passAccuracy || 65);
    setResult({ ...best, passed });
    if (passed) {
      completedRef.current = true;
      setCompleted(true);
      onCorrect?.(question.answer, {
        forceCorrect: true,
        input: "camera-reading",
        accuracy: best.accuracy,
        transcript: best.transcript,
      });
      return;
    }
    setAttempts((current) => current + 1);
  }, [disabled, onCorrect, question]);

  const {
    supported: speechSupported,
    listening,
    transcript: finalTranscript,
    interimTranscript,
    error: speechError,
    start: startListening,
    stop: stopListening,
    abort: abortListening,
  } = useSpeechRecognition({ language: isFilipino ? "fil-PH" : "en-PH", onResult: evaluateReading });

  useEffect(() => {
    completedRef.current = false;
    setCompleted(false);
    setAttempts(0);
    setTypedText("");
    setResult(null);
    setShowTypedPractice(!speechSupported);
    abortListening();
  }, [abortListening, question?.id, speechSupported]);

  useEffect(() => {
    if (!autoStart || autoAttemptedRef.current) return;
    autoAttemptedRef.current = true;
    startCamera();
  }, [autoStart, startCamera]);

  useEffect(() => () => {
    stopCamera();
    abortListening();
  }, [abortListening, stopCamera]);

  function beginReading() {
    if (disabled || completedRef.current) return;
    beforeListen?.();
    setResult(null);
    playSound("record");
    startListening();
  }

  function finishReading() {
    playSound("stop");
    stopListening();
  }

  function checkTypedPractice(event) {
    event.preventDefault();
    if (!typedText.trim() || disabled || completedRef.current) return;
    playSound("select");
    evaluateReading({ transcript: typedText, alternatives: [typedText] });
  }

  const transcript = interimTranscript || finalTranscript;
  const canSkip = attempts >= 2 || !speechSupported;

  return (
    <section className="camera-reading-stage" aria-label="Camera reading coach">
      <div className="camera-reading-stage__header">
        <div>
          <span><BookOpenCheck size={17} /> CAMERA READING COACH</span>
          <h2>{copy.title}</h2>
          <p>{copy.instruction}</p>
        </div>
        <button type="button" onClick={cameraActive ? stopCamera : startCamera} disabled={cameraLoading}>
          {cameraActive ? <CameraOff size={18} /> : <Camera size={18} />}
          {cameraLoading ? "Starting…" : cameraActive ? "Pause camera" : "Retry camera"}
        </button>
      </div>

      <div className="camera-reading-workspace">
        <div className="camera-reading-preview">
          <video ref={videoRef} muted playsInline aria-label="Live local reading camera preview" />
          {!cameraActive && (
            <div className="camera-reading-preview__off">
              {cameraLoading ? <Sparkles size={36} className="spin" /> : <CameraOff size={36} />}
              <strong>{cameraLoading ? "Opening your reading camera…" : "Camera preview is paused"}</strong>
              <p>{cameraError || "Voice and typed practice remain available without the camera."}</p>
            </div>
          )}
          {cameraActive && <span className="camera-reading-live"><i /> LIVE · THIS DEVICE ONLY</span>}
          <div className="camera-reading-posture"><span>Face the light</span><span>Speak clearly</span><span>Take your time</span></div>
        </div>

        <div className="camera-reading-coach">
          <div className="camera-reading-passage">
            <span>{question?.skill || "Reading fluency"}</span>
            <blockquote>{question?.readingText}</blockquote>
            <p>{question?.explanation}</p>
          </div>

          <div className={`camera-reading-listener ${listening ? "is-listening" : ""}`}>
            <div className="camera-reading-listener__pulse">{listening ? <Mic size={28} /> : <MicOff size={28} />}</div>
            <div>
              <strong>{listening ? copy.listening : copy.ready}</strong>
              <p>{transcript || speechError || copy.waiting}</p>
            </div>
          </div>

          {result && (
            <div className={`camera-reading-result ${result.passed ? "is-correct" : "is-practice"}`} role="status">
              {result.passed ? <CheckCircle2 size={23} /> : <RotateCcw size={23} />}
              <div>
                <strong>{result.passed ? `${copy.success} · ${result.accuracy}%` : `${copy.retry} · ${result.accuracy}%`}</strong>
                <p>{result.passed
                  ? copy.next
                  : result.missingWords.length
                    ? `Try these words again: ${result.missingWords.join(", ")}.`
                    : "Read a little more slowly and keep the same word order."}</p>
              </div>
            </div>
          )}

          <div className="camera-reading-actions">
            <button type="button" className="camera-reading-model" onClick={() => { playSound("button"); onModel?.(); }} disabled={disabled || listening}><Volume2 size={18} /> {copy.model}</button>
            <button type="button" className="camera-reading-record" onClick={listening ? finishReading : beginReading} disabled={disabled || (!speechSupported && !listening)}>
              {listening ? <MicOff size={20} /> : <Mic size={20} />}
              {listening ? copy.finish : attempts ? copy.readAgain : copy.read}
            </button>
            <button type="button" className="camera-reading-type" onClick={() => setShowTypedPractice((current) => !current)} disabled={disabled}><Keyboard size={18} /> {copy.typed}</button>
          </div>

          {showTypedPractice && (
            <form className="camera-reading-typed" onSubmit={checkTypedPractice}>
              <label htmlFor={`reading-typed-${question?.id}`}>{copy.typedLabel}</label>
              <div><input id={`reading-typed-${question?.id}`} value={typedText} onChange={(event) => setTypedText(event.target.value)} placeholder={copy.typedPlaceholder} /><button type="submit" disabled={!typedText.trim() || disabled}>{copy.check}</button></div>
            </form>
          )}

          {canSkip && !completed && (
            <button type="button" className="camera-reading-skip" onClick={onSkip} disabled={disabled}><SkipForward size={17} /> {copy.skip}</button>
          )}
        </div>
      </div>

      <div className="camera-reading-privacy">
        <ShieldCheck size={16} />
        <span>Jidanao does not upload or save camera video or microphone recordings. Voice recognition may be processed by the browser’s speech service; only the final game score is saved in Realtime Database.</span>
      </div>
    </section>
  );
}
