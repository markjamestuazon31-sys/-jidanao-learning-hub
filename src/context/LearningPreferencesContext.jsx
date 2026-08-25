import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { playGameSound, startBackgroundMusic, stopBackgroundMusic } from "../services/audioService";
import { speakText, stopSpeaking } from "../services/speechService";

const STORAGE_KEY = "jidanao-learning-preferences-v2";
const LEGACY_STORAGE_KEY = "jidanao-learning-preferences-v1";
const DEFAULTS = {
  voiceGender: "female",
  voiceVolume: 0.9,
  voiceRate: 0.95,
  soundEnabled: true,
  soundVolume: 0.35,
  musicEnabled: true,
  musicVolume: 0.065,
  reducedMotion: false,
};

const LearningPreferencesContext = createContext(null);

function readPreferences() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (stored) return { ...DEFAULTS, ...stored };
    const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || "null");
    return legacy ? { ...DEFAULTS, ...legacy, musicEnabled: true, musicVolume: DEFAULTS.musicVolume } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function LearningPreferencesProvider({ children }) {
  const [preferences, setPreferences] = useState(readPreferences);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    document.documentElement.dataset.reducedMotion = preferences.reducedMotion ? "true" : "false";
  }, [preferences]);

  useEffect(() => () => {
    stopSpeaking();
    stopBackgroundMusic();
  }, []);

  const updatePreferences = useCallback((changes) => {
    setPreferences((current) => ({ ...current, ...changes }));
  }, []);

  const speak = useCallback(
    (text) =>
      speakText(text, {
        gender: preferences.voiceGender,
        volume: preferences.voiceVolume,
        rate: preferences.voiceRate,
      }),
    [preferences.voiceGender, preferences.voiceRate, preferences.voiceVolume],
  );

  const playSound = useCallback(
    (name) => {
      if (preferences.soundEnabled) playGameSound(name, preferences.soundVolume);
    },
    [preferences.soundEnabled, preferences.soundVolume],
  );

  const beginMusic = useCallback((theme = "arcade") => {
    if (!preferences.musicEnabled) {
      stopBackgroundMusic();
      return () => {};
    }
    return startBackgroundMusic(preferences.musicVolume, theme);
  }, [preferences.musicEnabled, preferences.musicVolume]);

  const value = useMemo(
    () => ({
      ...preferences,
      updatePreferences,
      speak,
      stopSpeaking,
      playSound,
      beginMusic,
    }),
    [preferences, updatePreferences, speak, playSound, beginMusic],
  );

  return (
    <LearningPreferencesContext.Provider value={value}>
      {children}
    </LearningPreferencesContext.Provider>
  );
}

export function useLearningPreferences() {
  const value = useContext(LearningPreferencesContext);
  if (!value) throw new Error("useLearningPreferences must be used inside LearningPreferencesProvider.");
  return value;
}
