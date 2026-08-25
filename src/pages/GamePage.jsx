import {
  ArrowLeft,
  Award,
  Camera,
  CheckCircle2,
  Clock3,
  Flame,
  Gamepad2,
  Heart,
  LoaderCircle,
  Music2,
  Play,
  Printer,
  RotateCcw,
  Star,
  Target,
  Trophy,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import LearningAccessState from "../components/student/LearningAccessState";
import VoiceSettings from "../components/student/VoiceSettings";
import { useAuth } from "../context/AuthContext";
import { useLearningPreferences } from "../context/LearningPreferencesContext";
import { getGradeExperience, subjectTone } from "../data/gradeExperience";
import useCameraCardDetector from "../hooks/useCameraCardDetector";
import { getAuthorizedLearningContent } from "../services/learningContentService";
import { recordGameResult } from "../services/realtimeProgressService";
import {
  buildGameQuestions,
  calculateStars,
  cameraCardsForQuestion,
  gameTimerForGrade,
} from "../utils/gameEngine";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function printCards(cards, title) {
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (printWindow) printWindow.opener = null;
  if (!printWindow) throw new Error("Allow pop-ups to print the camera answer cards.");
  const cardsHtml = cards
    .map(
      (card) => `<article style="background:${card.hex};color:white;border-radius:24px;padding:28px;display:grid;place-items:center;min-height:220px;break-inside:avoid;box-shadow:inset 0 0 0 10px rgba(255,255,255,.28)"><small style="font:700 14px Arial;letter-spacing:.14em">JIDANAO NUMBER CARD</small><strong style="font:900 72px Arial;margin:20px 0">${escapeHtml(card.value)}</strong><span style="font:700 15px Arial">${escapeHtml(card.label)} card</span></article>`,
    )
    .join("");
  printWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(title)} answer cards</title></head><body style="font-family:Arial,sans-serif;margin:28px"><h1>${escapeHtml(title)} – Camera Answer Cards</h1><p>Cut out the four cards. During the game, place one card inside the on-screen camera guide.</p><main style="display:grid;grid-template-columns:1fr 1fr;gap:22px">${cardsHtml}</main><script>window.onload=()=>window.print();<\/script></body></html>`);
  printWindow.document.close();
}

function GameStat({ icon: Icon, label, value, tone }) {
  return (
    <div className={`student-game-stat student-game-stat--${tone}`}>
      <Icon size={19} /><div><span>{label}</span><strong>{value}</strong></div>
    </div>
  );
}

export default function GamePage() {
  const { id } = useParams();
  const { profile } = useAuth();
  const { speak, stopSpeaking, playSound, beginMusic, musicEnabled, soundEnabled } = useLearningPreferences();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [phase, setPhase] = useState("intro");
  const [mode, setMode] = useState("classic");
  const [difficulty, setDifficulty] = useState(1);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [feedback, setFeedback] = useState(null);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [cameraMessage, setCameraMessage] = useState("");
  const lockRef = useRef(false);
  const nextTimerRef = useRef(null);
  const finishRef = useRef(false);
  const cameraCorrectRef = useRef(false);
  const stopMusicRef = useRef(() => {});

  const grade = profile?.role === "student"
    ? profile?.gradeLevel || "Grade 3"
    : game?.grade || profile?.gradeLevel || "Grade 3";
  const experience = getGradeExperience(grade);
  const tone = subjectTone(game?.subject);
  const questions = useMemo(
    () => (game ? buildGameQuestions(game, grade, difficulty, 10) : []),
    [difficulty, game, grade],
  );
  const currentQuestion = questions[questionIndex];
  const roundSeconds = gameTimerForGrade(grade, difficulty);
  const cameraAvailable = String(game?.subject || "").toLowerCase().includes("math");
  const musicTheme = String(game?.subject || "").toLowerCase().includes("math")
    ? "math"
    : String(game?.subject || "").toLowerCase().includes("english")
      ? "reading"
      : "arcade";
  const cameraCards = useMemo(
    () => (currentQuestion ? cameraCardsForQuestion(currentQuestion) : []),
    [currentQuestion],
  );

  const finishGame = useCallback(
    async (finalScore, finalCorrect) => {
      if (finishRef.current) return;
      finishRef.current = true;
      lockRef.current = true;
      stopMusicRef.current?.();
      stopSpeaking();

      const maximumScore = questions.length * 150;
      const previewStars = calculateStars(finalScore, maximumScore);
      const previewXp = experience.gameXp + previewStars * 15 + difficulty * 10;
      setResult({
        score: finalScore,
        correct: finalCorrect,
        total: questions.length,
        stars: previewStars,
        xp: previewXp,
        verified: profile?.role !== "student",
      });
      setPhase("complete");
      playSound(previewStars >= 2 ? "achievement" : "level");

      if (profile?.role !== "student" || !game) {
        speak(`Game complete! You earned ${previewStars} stars, ${finalScore} points, and ${previewXp} experience points in preview mode.`);
        return;
      }

      setSaving(true);
      setCameraMessage("Saving your score and XP…");
      try {
        const verified = await recordGameResult(game.id, {
          score: finalScore,
          correctAnswers: finalCorrect,
          totalQuestions: questions.length,
          cameraWin: cameraCorrectRef.current,
          difficulty,
          mode,
        });
        setResult({
          score: verified.score,
          correct: verified.correct,
          total: verified.total,
          stars: verified.stars,
          xp: verified.xpAwarded,
          verified: true,
        });
        setCameraMessage("Result saved to your learning profile.");
        speak(`Game complete! You earned ${verified.stars} stars, ${verified.score} points, and ${verified.xpAwarded} experience points.`);
      } catch (error) {
        setCameraMessage(`The game finished, but the result was not saved: ${error.message}`);
        speak("The game is complete, but your result could not be saved. Please try again when your connection is available.");
      } finally {
        setSaving(false);
      }
    },
    [difficulty, experience.gameXp, game, mode, playSound, profile?.role, questions.length, speak, stopSpeaking],
  );

  const advanceAfterCorrect = useCallback(
    (nextScore, nextCorrect) => {
      nextTimerRef.current = window.setTimeout(() => {
        if (questionIndex >= questions.length - 1) {
          finishGame(nextScore, nextCorrect);
          return;
        }
        setQuestionIndex((value) => value + 1);
        setTimeLeft(roundSeconds);
        setFeedback(null);
        lockRef.current = false;
      }, 1050);
    },
    [finishGame, questionIndex, questions.length, roundSeconds],
  );

  const submitAnswer = useCallback(
    (selectedValue, usedCamera = false) => {
      if (phase !== "playing" || !currentQuestion || lockRef.current) return;
      lockRef.current = true;
      const correct = String(selectedValue).trim().toLowerCase() === String(currentQuestion.answer).trim().toLowerCase();
      if (correct) {
        const nextStreak = streak + 1;
        const timeBonus = Math.max(0, timeLeft) * 2;
        const streakBonus = Math.min(50, nextStreak * 5);
        const points = 100 + timeBonus + streakBonus;
        const nextScore = score + points;
        const nextCorrect = correctCount + 1;
        if (usedCamera) cameraCorrectRef.current = true;
        setScore(nextScore);
        setCorrectCount(nextCorrect);
        setStreak(nextStreak);
        setFeedback({ type: "correct", text: currentQuestion.explanation, points });
        playSound(nextStreak > 0 && nextStreak % 3 === 0 ? "streak" : "correct");
        speak(`Excellent! ${currentQuestion.explanation}`);
        advanceAfterCorrect(nextScore, nextCorrect);
      } else {
        const nextLives = lives - 1;
        setLives(nextLives);
        setStreak(0);
        setFeedback({ type: "wrong", text: "Try again. Compare the choices and use the clue." });
        playSound("wrong");
        speak("Try again. Find the correct answer.");
        if (nextLives <= 0) {
          nextTimerRef.current = window.setTimeout(() => finishGame(score, correctCount), 1100);
        } else {
          nextTimerRef.current = window.setTimeout(() => {
            setFeedback(null);
            lockRef.current = false;
          }, 900);
        }
      }
    },
    [advanceAfterCorrect, correctCount, currentQuestion, finishGame, lives, phase, playSound, score, speak, streak, timeLeft],
  );

  const handleDetectedCard = useCallback(
    (card) => {
      setCameraMessage(`${card.label} card detected: ${card.value}`);
      submitAnswer(card.value, true);
    },
    [submitAnswer],
  );

  const camera = useCameraCardDetector({ cards: cameraCards, onDetected: handleDetectedCard });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    setGame(null);

    getAuthorizedLearningContent({ type: "game", contentId: id, profile })
      .then((authorizedGame) => {
        if (!active) return;
        setGame(authorizedGame);
      })
      .catch((error) => {
        if (!active) return;
        console.error("Unable to load protected game:", error);
        setLoadError(error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [id, profile]);

  useEffect(() => {
    if (phase !== "playing" || feedback || lockRef.current) return undefined;
    const interval = window.setInterval(() => {
      setTimeLeft((current) => {
        if (current > 1) {
          if (current <= 6) playSound("tick");
          return current - 1;
        }
        window.clearInterval(interval);
        lockRef.current = true;
        const nextLives = lives - 1;
        setLives(nextLives);
        setStreak(0);
        setFeedback({ type: "wrong", text: `Time is up. The correct answer is ${currentQuestion?.answer}.` });
        playSound("timeout");
        speak(`Time is up. The correct answer is ${currentQuestion?.answer}.`);
        if (nextLives <= 0) {
          nextTimerRef.current = window.setTimeout(() => finishGame(score, correctCount), 1200);
        } else {
          nextTimerRef.current = window.setTimeout(() => {
            if (questionIndex >= questions.length - 1) finishGame(score, correctCount);
            else {
              setQuestionIndex((value) => value + 1);
              setTimeLeft(roundSeconds);
              setFeedback(null);
              lockRef.current = false;
            }
          }, 1200);
        }
        return 0;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [correctCount, currentQuestion?.answer, feedback, finishGame, lives, mode, phase, playSound, questionIndex, questions.length, roundSeconds, score, speak]);

  useEffect(() => {
    if (mode !== "camera" || phase !== "playing") camera.stop();
  }, [camera.stop, mode, phase]);

  useEffect(() => () => {
    if (nextTimerRef.current) window.clearTimeout(nextTimerRef.current);
    stopMusicRef.current?.();
    camera.stop();
    stopSpeaking();
  }, [camera.stop, stopSpeaking]);

  function startGame() {
    if (!game) return;
    if (mode === "camera" && !cameraAvailable) setMode("classic");
    finishRef.current = false;
    cameraCorrectRef.current = false;
    lockRef.current = false;
    setQuestionIndex(0);
    setScore(0);
    setCorrectCount(0);
    setLives(3);
    setStreak(0);
    setTimeLeft(gameTimerForGrade(grade, difficulty));
    setFeedback(null);
    setResult(null);
    setCameraMessage("");
    setPhase("playing");
    playSound("start");
    stopMusicRef.current = beginMusic(musicTheme);
    window.setTimeout(() => {
      const first = buildGameQuestions(game, grade, difficulty, 10)[0];
      speak(`${game.title}. Question one. ${first?.prompt || "Begin the challenge."}`);
    }, 250);
  }

  function restartGame() {
    camera.stop();
    stopMusicRef.current?.();
    setPhase("intro");
    setResult(null);
    setFeedback(null);
    finishRef.current = false;
    cameraCorrectRef.current = false;
    lockRef.current = false;
  }

  async function toggleCamera() {
    setCameraMessage("");
    try {
      if (camera.active) camera.stop();
      else await camera.start();
    } catch (error) {
      setCameraMessage(error.message || "Camera permission was not granted.");
    }
  }

  function readQuestion() {
    if (currentQuestion) speak(`${currentQuestion.prompt}. Choices: ${currentQuestion.choices.join(", ")}.`);
  }

  if (loading && !game) {
    return <div className="student-state-card lesson-page-state"><LoaderCircle className="spin" size={30} /><div><strong>Loading learning game…</strong><p>Preparing levels, questions, sound, and saved progress.</p></div></div>;
  }
  if (!game || loadError) {
    return (
      <LearningAccessState
        type="game"
        error={loadError}
        grade={profile?.gradeLevel}
        role={profile?.role}
      />
    );
  }

  if (phase === "intro") {
    return (
      <div className={`student-game student-game-intro student-theme--${experience.theme}`}>
        <header className="student-game-intro__header">
          <Link to={profile?.role === "student" ? "/student/games" : "/games"}><ArrowLeft size={17} /> Back to games</Link>
          <VoiceSettings compact />
        </header>
        <main className={`student-game-intro__card student-game-intro__card--${tone}`}>
          <div className="student-game-intro__art"><span><Gamepad2 size={64} /></span><i /><i /></div>
          <div className="student-game-intro__copy">
            <span>{game.subject || "Learning Game"} • {grade}</span>
            <h1>{game.title || "Learning Challenge"}</h1>
            <p>{game.description || "Practice grade-level skills through a professional adaptive challenge."}</p>
            <div className="student-game-intro__features"><span><Target size={17} /> 10 challenges</span><span><Clock3 size={17} /> Timed rounds</span><span><Award size={17} /> Stars & XP</span><span><Music2 size={17} /> Music & game sounds</span><span><Volume2 size={17} /> Voice feedback</span></div>

            <div className="student-game-settings">
              <fieldset><legend>Difficulty</legend>{[1, 2, 3].map((level) => <button type="button" className={difficulty === level ? "is-active" : ""} onClick={() => setDifficulty(level)} key={level}>{level === 1 ? "Explorer" : level === 2 ? "Challenger" : "Master"}</button>)}</fieldset>
              <fieldset><legend>Game mode</legend><button type="button" className={mode === "classic" ? "is-active" : ""} onClick={() => setMode("classic")}><Gamepad2 size={16} /> Classic</button><button type="button" disabled={!cameraAvailable} className={mode === "camera" ? "is-active" : ""} onClick={() => setMode("camera")}><Camera size={16} /> Camera cards</button></fieldset>
            </div>

            {mode === "camera" && <div className="student-game-camera-note"><Camera size={20} /><div><strong>Controlled camera-card mode</strong><p>Print the four colored number cards. Detection runs locally in the browser; no photo or video is uploaded.</p></div></div>}
            <div className="student-game-audio-ready"><Music2 size={21} /><div><strong>Professional game audio ready</strong><span>{musicEnabled ? "Background music on" : "Background music muted"} · {soundEnabled ? "Game effects on" : "Game effects muted"}. Change these anytime in Learning Settings.</span></div></div>
            <button type="button" className="student-game-start" onClick={startGame}><Play size={20} fill="currentColor" /> Start game</button>
          </div>
        </main>
      </div>
    );
  }

  if (phase === "complete") {
    return (
      <div className={`student-game student-game-complete student-theme--${experience.theme}`}>
        <section className="student-game-complete__card">
          <div className="student-game-complete__trophy"><Trophy size={70} /></div>
          <span>LEVEL COMPLETE</span>
          <h1>{result.stars >= 2 ? "Excellent work!" : "Good effort!"}</h1>
          <p>
            {profile?.role === "student"
              ? result.verified
                ? `You completed ${game.title}. Your score and XP were saved to Realtime Database.`
                : `You completed ${game.title}. This result has not been saved yet.`
              : `You completed ${game.title} in preview mode.`}
          </p>
          <div className="student-game-complete__stars">{[1, 2, 3].map((star) => <Star key={star} size={42} fill={star <= result.stars ? "currentColor" : "none"} className={star <= result.stars ? "is-earned" : ""} />)}</div>
          <div className="student-game-complete__stats"><div><strong>{result.score}</strong><span>Points</span></div><div><strong>{result.correct}/{result.total}</strong><span>Correct</span></div><div><strong>+{result.xp}</strong><span>XP</span></div></div>
          {cameraMessage && <div className="student-game-inline-message">{cameraMessage}</div>}
          <div className="student-game-complete__actions"><button type="button" onClick={restartGame}><RotateCcw size={18} /> Play again</button><Link to={profile?.role === "student" ? "/student/dashboard" : "/games"}>Return to learning hub</Link></div>
          {saving && <small><LoaderCircle className="spin" size={14} /> Saving result…</small>}
        </section>
      </div>
    );
  }

  const level = Math.min(4, Math.floor(questionIndex / 3) + 1);

  return (
    <div className={`student-game student-game-board-v2 student-theme--${experience.theme}`}>
      <header className="student-game-board-v2__header">
        <div><button type="button" onClick={restartGame}><X size={18} /> Exit</button><div><span>{game.subject} • {grade}</span><h1>{game.title}</h1></div></div>
        <VoiceSettings compact />
      </header>

      <section className="student-game-stats-row">
        <GameStat icon={Star} label="Score" value={score} tone="yellow" />
        <GameStat icon={Zap} label="Level" value={level} tone="blue" />
        <GameStat icon={Flame} label="Streak" value={streak} tone="orange" />
        <GameStat icon={Heart} label="Lives" value={lives} tone="red" />
      </section>

      <div className="student-game-round-progress"><div><span>Challenge {questionIndex + 1} of {questions.length}</span><strong>{Math.round(((questionIndex + 1) / questions.length) * 100)}%</strong></div><div><span style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }} /></div></div>

      <main className={`student-game-play-layout ${mode === "camera" ? "is-camera" : ""}`}>
        <section className="student-game-question-card">
          <div className="student-game-question-card__top"><span>{currentQuestion.skill || "Learning challenge"}</span><button type="button" onClick={readQuestion}><Volume2 size={17} /> Read question</button></div>
          <div className={`student-game-timer ${timeLeft <= 7 ? "is-urgent" : ""}`}><svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="18" /><circle cx="22" cy="22" r="18" style={{ strokeDashoffset: 113 - (113 * timeLeft) / roundSeconds }} /></svg><strong>{timeLeft}</strong></div>
          <h2>{currentQuestion.prompt}</h2>
          {mode === "classic" ? (
            <div className="student-game-choice-grid">
              {currentQuestion.choices.map((choice, index) => <button type="button" disabled={Boolean(feedback)} onClick={() => submitAnswer(choice)} key={choice}><span>{String.fromCharCode(65 + index)}</span><strong>{choice}</strong></button>)}
            </div>
          ) : (
            <div className="student-game-camera-answers">
              <p>Place the matching colored number card inside the camera guide.</p>
              <div>{cameraCards.map((card) => <span key={card.id}><i style={{ backgroundColor: card.hex }} />{card.value}</span>)}</div>
              <button type="button" onClick={() => printCards(cameraCards, game.title)}><Printer size={17} /> Print current cards</button>
            </div>
          )}
          {feedback && <div className={`student-game-feedback is-${feedback.type}`}>{feedback.type === "correct" ? <CheckCircle2 size={25} /> : <X size={25} />}<div><strong>{feedback.type === "correct" ? `Correct! +${feedback.points}` : "Try again"}</strong><p>{feedback.text}</p></div></div>}
        </section>

        {mode === "camera" && (
          <aside className="student-camera-lab">
            <div className="student-camera-lab__heading"><div><Camera size={22} /><div><span>CAMERA LEARNING LAB</span><h2>Number-card detector</h2></div></div><span className={camera.active ? "is-live" : ""}>{camera.active ? "LIVE" : "OFF"}</span></div>
            <div className="student-camera-lab__viewport">
              <video ref={camera.videoRef} autoPlay playsInline muted />
              {!camera.active && <div><Camera size={42} /><p>Start the camera to detect a colored answer card.</p></div>}
              {camera.active && <div className="student-camera-lab__guide"><span>Place card here</span></div>}
            </div>
            <div className="student-camera-lab__status"><strong>{camera.status}</strong><div><span style={{ width: `${camera.confidence}%` }} /></div><small>Detection confidence: {camera.confidence}%</small></div>
            {cameraMessage && <p className="student-camera-lab__message">{cameraMessage}</p>}
            <button type="button" className={camera.active ? "is-stop" : ""} onClick={toggleCamera}><Camera size={18} /> {camera.active ? "Stop camera" : "Start camera"}</button>
            <small>Video processing stays on this device. Nothing is stored in Firebase.</small>
          </aside>
        )}
      </main>
    </div>
  );
}
