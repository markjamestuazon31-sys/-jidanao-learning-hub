import { Gauge, Music2, SlidersHorizontal, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLearningPreferences } from "../../context/LearningPreferencesContext";

export default function VoiceSettings({ compact = false }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const {
    voiceGender,
    voiceVolume,
    voiceRate,
    soundEnabled,
    soundVolume,
    musicEnabled,
    musicVolume,
    reducedMotion,
    updatePreferences,
    speak,
    playSound,
  } = useLearningPreferences();

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!panelRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function previewVoice() {
    playSound("button");
    speak("Hello! I am ready to help you learn, play, and achieve.");
  }

  return (
    <div ref={panelRef} className={`student-preferences ${compact ? "is-compact" : ""}`}>
      <button
        type="button"
        className="student-preferences__toggle"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <SlidersHorizontal size={17} />
        <span>{compact ? "Learning settings" : "Voice & sound"}</span>
      </button>

      {open && (
        <div className="student-preferences__panel" role="dialog" aria-label="Learning settings">
          <div className="student-preferences__heading">
            <div>
              <strong>Learning settings</strong>
              <span>Adjust narration, sound, and motion.</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close settings">
              <X size={17} />
            </button>
          </div>

          <label>
            <span>Voice</span>
            <select
              value={voiceGender}
              onChange={(event) => updatePreferences({ voiceGender: event.target.value })}
            >
              <option value="female">Female voice</option>
              <option value="male">Male voice</option>
            </select>
          </label>

          <label>
            <span><Volume2 size={15} /> Voice volume</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={voiceVolume}
              onChange={(event) => updatePreferences({ voiceVolume: Number(event.target.value) })}
            />
          </label>

          <label>
            <span><Gauge size={15} /> Voice speed</span>
            <input
              type="range"
              min="0.65"
              max="1.45"
              step="0.05"
              value={voiceRate}
              onChange={(event) => updatePreferences({ voiceRate: Number(event.target.value) })}
            />
          </label>

          <label className="student-preferences__switch">
            <span>{soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />} Sound effects</span>
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(event) => updatePreferences({ soundEnabled: event.target.checked })}
            />
          </label>

          {soundEnabled && (
            <label>
              <span>Sound volume</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={soundVolume}
                onChange={(event) => updatePreferences({ soundVolume: Number(event.target.value) })}
              />
            </label>
          )}

          <label className="student-preferences__switch">
            <span><Music2 size={16} /> Game music</span>
            <input
              type="checkbox"
              checked={musicEnabled}
              onChange={(event) => updatePreferences({ musicEnabled: event.target.checked })}
            />
          </label>

          {musicEnabled && (
            <label>
              <span>Music volume</span>
              <input
                type="range"
                min="0"
                max="0.16"
                step="0.01"
                value={musicVolume}
                onChange={(event) => updatePreferences({ musicVolume: Number(event.target.value) })}
              />
            </label>
          )}

          <label className="student-preferences__switch">
            <span>Reduce animations</span>
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(event) => updatePreferences({ reducedMotion: event.target.checked })}
            />
          </label>

          <button type="button" className="student-preferences__preview" onClick={previewVoice}>
            <Volume2 size={16} /> Preview voice
          </button>
        </div>
      )}
    </div>
  );
}
