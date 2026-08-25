import { useCallback, useEffect, useRef, useState } from "react";

function recognitionConstructor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export default function useSpeechRecognition({ language = "en-PH", onResult } = {}) {
  const Recognition = recognitionConstructor();
  const recognitionRef = useRef(null);
  const resultRef = useRef(onResult);
  const finalReceivedRef = useRef(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { resultRef.current = onResult; }, [onResult]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop?.();
  }, []);

  const abort = useCallback(() => {
    recognitionRef.current?.abort?.();
    recognitionRef.current = null;
    setListening(false);
    setInterimTranscript("");
  }, []);

  const start = useCallback(() => {
    if (!Recognition) {
      setError("Voice checking is unavailable in this browser. Use Chrome or Edge, or use the typed practice box.");
      return false;
    }

    recognitionRef.current?.abort?.();
    finalReceivedRef.current = false;
    setTranscript("");
    setInterimTranscript("");
    setError("");

    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = language;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;

    recognition.onstart = () => setListening(true);
    recognition.onresult = (event) => {
      let interim = "";
      let final = "";
      const alternatives = [];
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const value = result[0]?.transcript?.trim() || "";
        if (result.isFinal) {
          final = `${final} ${value}`.trim();
          Array.from(result).forEach((item) => {
            if (item?.transcript) alternatives.push(item.transcript.trim());
          });
        } else {
          interim = `${interim} ${value}`.trim();
        }
      }
      setInterimTranscript(interim);
      if (final) {
        finalReceivedRef.current = true;
        setTranscript(final);
        setInterimTranscript("");
        resultRef.current?.({ transcript: final, alternatives: [...new Set([final, ...alternatives])] });
      }
    };
    recognition.onerror = (event) => {
      const messages = {
        "audio-capture": "No microphone was found. Connect a microphone or use typed practice.",
        "not-allowed": "Microphone permission was blocked. Allow microphone access or use typed practice.",
        "no-speech": "No words were heard. Move closer to the microphone and try again.",
        network: "Voice checking could not connect. Try again or use typed practice.",
      };
      setError(messages[event.error] || "Voice checking stopped. Please try again.");
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
      setInterimTranscript("");
      if (!finalReceivedRef.current) {
        setError((current) => current || "I did not hear a complete sentence. Press Read now and try again.");
      }
      recognitionRef.current = null;
    };

    try {
      recognition.start();
      return true;
    } catch (startError) {
      setError(startError?.message || "Voice checking could not start.");
      setListening(false);
      return false;
    }
  }, [Recognition, language]);

  useEffect(() => () => recognitionRef.current?.abort?.(), []);

  return {
    supported: Boolean(Recognition),
    listening,
    transcript,
    interimTranscript,
    error,
    start,
    stop,
    abort,
  };
}
