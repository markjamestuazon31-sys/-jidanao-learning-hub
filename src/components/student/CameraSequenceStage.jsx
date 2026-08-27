import { Camera, CameraOff, Grab, Hand, ShieldCheck, Sparkles, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLearningPreferences } from "../../context/LearningPreferencesContext";
import useHandTracking from "../../hooks/useHandTracking";
import "../../styles/camera-sequence.css";

const DROP_AREA = { left: 0.18, right: 0.82, top: 0.64, bottom: 0.9 };
const POSITIONS = [
  { x: 0.16, y: 0.27 }, { x: 0.39, y: 0.37 }, { x: 0.62, y: 0.27 },
  { x: 0.84, y: 0.37 }, { x: 0.28, y: 0.51 }, { x: 0.72, y: 0.51 },
];

function inside(point, area) {
  return Boolean(point && point.x >= area.left && point.x <= area.right && point.y >= area.top && point.y <= area.bottom);
}

function shuffledBlocks(choices, key) {
  const seed = String(key || "camera-sequence").split("").reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const blocks = choices.map((value, index) => ({ id: `${index}-${value}`, value: String(value), sourceIndex: index }));
  return blocks.sort((left, right) => (((left.sourceIndex + 1) * 31 + seed) % 97) - (((right.sourceIndex + 1) * 31 + seed) % 97));
}

export default function CameraSequenceStage({
  choices = [],
  questionKey,
  onComplete,
  separator = " ",
  itemNoun = "word block",
  disabled = false,
  autoStart = true,
}) {
  const { playSound } = useLearningPreferences();
  const { videoRef, active, loading, status, error, cursor, pinching, start, stop } = useHandTracking();
  const blocks = useMemo(() => shuffledBlocks(choices.filter(Boolean).slice(0, 6), questionKey), [choices, questionKey]);
  const [placedIds, setPlacedIds] = useState([]);
  const [grabbedId, setGrabbedId] = useState("");
  const [hoveredId, setHoveredId] = useState("");
  const [message, setMessage] = useState("Starting the camera automatically…");
  const previousPinchRef = useRef(false);
  const grabbedRef = useRef("");
  const completedRef = useRef(false);
  const autoAttemptedRef = useRef(false);
  const completeRef = useRef(onComplete);

  useEffect(() => { completeRef.current = onComplete; }, [onComplete]);
  useEffect(() => { grabbedRef.current = grabbedId; }, [grabbedId]);

  useEffect(() => {
    setPlacedIds([]);
    setGrabbedId("");
    setHoveredId("");
    completedRef.current = false;
    previousPinchRef.current = false;
    setMessage(`Pinch the first ${itemNoun} and place it in the build box.`);
  }, [itemNoun, questionKey]);

  useEffect(() => {
    if (!autoStart || autoAttemptedRef.current) return;
    autoAttemptedRef.current = true;
    start().then(() => setMessage(`Camera ready. Pinch the first ${itemNoun}.`)).catch((startError) => setMessage(startError?.message || "Camera access could not start."));
  }, [autoStart, itemNoun, start]);

  useEffect(() => () => stop(), [stop]);

  const availableBlocks = useMemo(() => blocks.filter((block) => !placedIds.includes(block.id)), [blocks, placedIds]);
  const placedBlocks = useMemo(() => placedIds.map((id) => blocks.find((block) => block.id === id)).filter(Boolean), [blocks, placedIds]);

  const findHovered = useCallback((point) => {
    if (!point) return "";
    const index = availableBlocks.findIndex((block) => {
      const position = POSITIONS[blocks.findIndex((candidate) => candidate.id === block.id)] || POSITIONS[0];
      return Math.abs(point.x - position.x) <= 0.11 && Math.abs(point.y - position.y) <= 0.12;
    });
    return index >= 0 ? availableBlocks[index].id : "";
  }, [availableBlocks, blocks]);

  const placeBlock = useCallback((blockId, source) => {
    if (!blockId || disabled || completedRef.current) return;
    const nextIds = [...placedIds, blockId];
    setPlacedIds(nextIds);
    setGrabbedId("");
    playSound("drop");
    if (nextIds.length === blocks.length) {
      const answer = nextIds.map((id) => blocks.find((block) => block.id === id)?.value || "").join(separator);
      completedRef.current = true;
      setMessage("Sequence complete. Checking and saving the answer…");
      completeRef.current?.(answer, { input: source, interaction: "pinch-sequence" });
    } else {
      setMessage(`${nextIds.length} of ${blocks.length} blocks placed. Choose the next ${itemNoun}.`);
    }
  }, [blocks, disabled, itemNoun, placedIds, playSound, separator]);

  useEffect(() => {
    if (!active || disabled || completedRef.current) return;
    const wasPinching = previousPinchRef.current;
    previousPinchRef.current = pinching;
    const hovered = findHovered(cursor);
    if (!grabbedRef.current) setHoveredId(hovered);
    if (pinching && !wasPinching && !grabbedRef.current && hovered) {
      grabbedRef.current = hovered;
      setGrabbedId(hovered);
      setHoveredId("");
      playSound("grab");
      setMessage(`Keep pinching and move the ${itemNoun} into the build box.`);
      return;
    }
    if (!pinching && wasPinching && grabbedRef.current) {
      if (inside(cursor, DROP_AREA)) placeBlock(grabbedRef.current, "camera-drag");
      else {
        grabbedRef.current = "";
        setGrabbedId("");
        setMessage(`Almost! Release the ${itemNoun} inside the large build box.`);
      }
    }
  }, [active, cursor, disabled, findHovered, itemNoun, pinching, placeBlock, playSound]);

  function undoBlock() {
    if (!placedIds.length || disabled || completedRef.current) return;
    playSound("button");
    setPlacedIds((current) => current.slice(0, -1));
    setMessage(`Last ${itemNoun} returned. Continue building.`);
  }

  async function retryCamera() {
    try {
      if (active) {
        stop();
        setMessage("Camera paused. Tap Retry camera when ready.");
      } else {
        await start();
        setMessage(`Camera ready. Pinch a ${itemNoun}.`);
      }
    } catch (startError) {
      setMessage(startError?.message || "Camera access could not start.");
    }
  }

  const grabbedBlock = blocks.find((block) => block.id === grabbedId);
  const overDrop = Boolean(grabbedId) && inside(cursor, DROP_AREA);

  return (
    <section className="camera-sequence-stage" aria-label="Camera word and sequence builder">
      <div className="camera-sequence-toolbar">
        <div><span className={active ? "is-live" : ""}><i /> {active ? "Camera ready" : loading ? "Starting camera" : "Camera paused"}</span><p aria-live="polite">{message || error || status}</p></div>
        <button type="button" onClick={retryCamera} disabled={loading}>{active ? <CameraOff size={18} /> : <Camera size={18} />}{loading ? "Starting…" : active ? "Pause camera" : "Retry camera"}</button>
      </div>

      <div className="camera-sequence-steps"><span><b>1</b> Pinch</span><span><b>2</b> Move in order</span><span><b>3</b> Open hand</span><button type="button" onClick={undoBlock} disabled={!placedIds.length || disabled || completedRef.current}><Undo2 size={16} /> Undo last</button></div>

      <div className="camera-sequence-viewport">
        <video ref={videoRef} muted playsInline aria-label="Live local camera preview" />
        {!active && <div className="camera-sequence-camera-off"><Hand size={48} /><strong>{loading ? "Preparing your hand controller…" : "Camera needs permission"}</strong><p>{loading ? "The game starts when hand tracking is ready." : "Allow camera access, then press Retry camera. Tap controls remain available."}</p></div>}
        {active && !cursor && <div className="camera-sequence-hand-guide"><Hand size={25} /> Raise one hand where the camera can see it</div>}

        {blocks.map((block, index) => {
          if (placedIds.includes(block.id)) return null;
          const position = POSITIONS[index];
          const dragging = grabbedId === block.id;
          return <button type="button" key={block.id} className={`camera-sequence-block tone-${(index % 4) + 1} ${hoveredId === block.id ? "is-hovered" : ""} ${dragging ? "is-grabbed" : ""}`} style={{ left: `${(dragging && cursor ? cursor.x : position.x) * 100}%`, top: `${(dragging && cursor ? cursor.y : position.y) * 100}%` }} onClick={() => { if (!disabled) { setGrabbedId(block.id); grabbedRef.current = block.id; playSound("grab"); setMessage(`Selected ${block.value}. Tap the build box to place it.`); } }} disabled={disabled || completedRef.current}><small>{index + 1}</small><strong>{block.value}</strong><Grab size={15} /></button>;
        })}

        <button type="button" className={`camera-sequence-drop ${overDrop ? "is-ready" : ""} ${grabbedId ? "has-block" : ""}`} onClick={() => placeBlock(grabbedId, "tap-drop")} disabled={!grabbedId || disabled || completedRef.current}>
          <Sparkles size={22} /><strong>{overDrop ? "OPEN YOUR HAND" : grabbedId ? `PLACE “${grabbedBlock?.value}”` : "BUILD IN THE CORRECT ORDER"}</strong>
          <div>{placedBlocks.length ? placedBlocks.map((block, index) => <span key={block.id}><b>{index + 1}</b>{block.value}</span>) : <em>Your sequence will appear here</em>}</div>
        </button>
        {cursor && <span className={`camera-sequence-cursor ${pinching ? "is-pinching" : ""}`} style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%` }}>{pinching ? <Grab size={19} /> : <Hand size={19} />}</span>}
      </div>

      <div className="camera-sequence-privacy"><ShieldCheck size={16} /> Camera frames stay on this device and are never uploaded or saved.</div>
    </section>
  );
}
