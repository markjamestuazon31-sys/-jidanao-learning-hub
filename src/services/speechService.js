const FEMALE_VOICE_HINTS = /female|zira|samantha|aria|jenny|susan|hazel|google uk english female/i;
const MALE_VOICE_HINTS = /male|david|mark|guy|george|daniel|google uk english male/i;

function getVoices() {
  if (!("speechSynthesis" in globalThis)) return [];
  return globalThis.speechSynthesis.getVoices() || [];
}

function selectVoice(gender = "female") {
  const voices = getVoices();
  const englishVoices = voices.filter((voice) => /^en(-|_)/i.test(voice.lang || ""));
  const pool = englishVoices.length ? englishVoices : voices;
  const hint = gender === "male" ? MALE_VOICE_HINTS : FEMALE_VOICE_HINTS;
  return pool.find((voice) => hint.test(voice.name)) || pool[0] || null;
}

export function speakText(text, options = {}) {
  const content = String(text || "").trim();
  if (!content) return false;
  if (!("speechSynthesis" in globalThis) || !("SpeechSynthesisUtterance" in globalThis)) {
    return false;
  }

  globalThis.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(content);
  const voice = selectVoice(options.gender);
  if (voice) utterance.voice = voice;
  utterance.volume = Math.max(0, Math.min(1, Number(options.volume ?? 0.9)));
  utterance.rate = Math.max(0.55, Math.min(1.6, Number(options.rate ?? 1)));
  utterance.pitch = options.gender === "male" ? 0.9 : 1.05;
  utterance.lang = voice?.lang || "en-US";
  globalThis.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking() {
  if ("speechSynthesis" in globalThis) globalThis.speechSynthesis.cancel();
}
