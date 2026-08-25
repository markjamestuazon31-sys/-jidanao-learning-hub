import {
  ArrowLeft,
  Award,
  CheckCircle2,
  GraduationCap,
  LoaderCircle,
  Lock,
  Printer,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { normalizeGradeLevel, systemCatalogForGrade } from "../data/gradeExperience";
import { normalizeProgress, subscribeUserProgress } from "../services/dataService";

function normalizeTrack(value) {
  if (value === "english") return value;
  if (value === "math") return value;
  return "";
}

function trackTitle(track) {
  if (track === "english") return "English Camera Reading";
  return "Camera Mathematics";
}

function certificateNumber(uid, track, timestamp) {
  const date = new Date(Number(timestamp) || 0);
  const day = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return `JES-${track.slice(0, 3).toUpperCase()}-${String(uid || "STUDENT").slice(0, 6).toUpperCase()}-${day}`;
}

export default function CameraLearningCertificate() {
  const { track: routeTrack } = useParams();
  const { user, profile } = useAuth();
  const track = normalizeTrack(routeTrack);
  const grade = normalizeGradeLevel(profile?.gradeLevel) || "Grade 3";
  const [progress, setProgress] = useState(() => normalizeProgress({}));
  const [loading, setLoading] = useState(true);
  const [fallbackTimestamp] = useState(() => Date.now());
  const game = useMemo(
    () => systemCatalogForGrade(grade).find((item) => item.certificateTrack === track),
    [grade, track],
  );
  const record = progress.game?.[game?.id] || {};
  const completedLevels = Object.values(record.levels || {}).filter((level) => level?.passed).length;
  const eligible = Boolean(record.certificateEligible && record.levels?.["level-10"]?.passed);
  const earnedAt = Number(record.certificateEarnedAt || record.levels?.["level-10"]?.completedAt || record.completedAt || fallbackTimestamp);

  useEffect(() => {
    if (!user?.uid) return undefined;
    setLoading(true);
    return subscribeUserProgress(
      user.uid,
      (nextProgress) => {
        setProgress(nextProgress);
        setLoading(false);
      },
      (error) => {
        console.warn("Unable to verify camera-learning certificate:", error);
        setLoading(false);
      },
    );
  }, [user?.uid]);

  if (!track) {
    return (
      <div className="camera-certificate-page">
        <Link className="student-back-link" to="/student/games"><ArrowLeft size={17} /> Back to learning games</Link>
        <section className="camera-certificate-locked">
          <div><Lock size={42} /></div>
          <span>CERTIFICATE NOT AVAILABLE</span>
          <h1>This camera-learning track is no longer offered.</h1>
          <p>Choose Weekly Camera Math Mission or English Camera Reading from your grade’s learning games.</p>
          <Link className="primary-button" to="/student/games">Open learning games</Link>
        </section>
      </div>
    );
  }

  if (loading) {
    return <div className="student-state-card"><LoaderCircle className="spin" size={30} /><div><strong>Verifying your Level 10 achievement…</strong><p>Checking your saved Realtime Database progress.</p></div></div>;
  }

  if (!eligible) {
    return (
      <div className="camera-certificate-page">
        <Link className="student-back-link" to={game?.route || "/student/games"}><ArrowLeft size={17} /> Back to {trackTitle(track)}</Link>
        <section className="camera-certificate-locked">
          <div><Lock size={42} /></div>
          <span>LEVEL 10 CERTIFICATE</span>
          <h1>Keep learning—your certificate is waiting!</h1>
          <p>Complete all levels and pass Level 10 with at least 7 of 10 correct activities to unlock this certificate.</p>
          <div className="camera-certificate-levels">
            {Array.from({ length: 10 }, (_, index) => index + 1).map((level) => (
              <span className={record.levels?.[`level-${level}`]?.passed ? "is-complete" : ""} key={level}>{record.levels?.[`level-${level}`]?.passed ? <CheckCircle2 size={15} /> : <Lock size={13} />} {level}</span>
            ))}
          </div>
          <strong>{completedLevels}/10 levels completed</strong>
          <Link className="primary-button" to={game?.route || "/student/games"}>Continue learning</Link>
        </section>
      </div>
    );
  }

  const studentName = profile?.name || profile?.displayName || user?.displayName || "Jidanao Learner";
  const issuedDate = new Date(earnedAt).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  const certificateId = certificateNumber(user?.uid, track, earnedAt);

  return (
    <div className="camera-certificate-page">
      <div className="camera-certificate-toolbar">
        <Link to={game?.route || "/student/games"}><ArrowLeft size={17} /> Back to game</Link>
        <p><ShieldCheck size={16} /> Verified from this student’s saved Level 10 progress</p>
        <button type="button" onClick={() => window.print()}><Printer size={18} /> Print / Save as PDF</button>
      </div>

      <article className="camera-certificate" aria-label={`${trackTitle(track)} certificate for ${studentName}`}>
        <div className="camera-certificate__border">
          <header>
            <img src="/jidanao-seal.png" alt="Jidanao Elementary School seal" />
            <div><span>REPUBLIC OF THE PHILIPPINES</span><strong>JIDANAO ELEMENTARY SCHOOL</strong><small>Jidanao Learning Hub</small></div>
            <GraduationCap size={54} />
          </header>

          <main>
            <div className="camera-certificate__award"><Award size={25} /><span>CERTIFICATE OF ACHIEVEMENT</span><Award size={25} /></div>
            <p>This certificate is proudly presented to</p>
            <h1>{studentName}</h1>
            <div className="camera-certificate__name-line" />
            <p>for successfully completing all ten levels of</p>
            <h2>{trackTitle(track)}</h2>
            <p className="camera-certificate__statement">The learner completed 10 activities in every level, passed the Level 10 mastery requirement, and demonstrated dedication, confidence, and continued growth in {grade}.</p>
            <div className="camera-certificate__medallion"><GraduationCap size={36} /><strong>LEVEL 10</strong><span>COMPLETED</span></div>
          </main>

          <footer>
            <div><strong>{issuedDate}</strong><span>Date Awarded</span></div>
            <div className="camera-certificate__verified"><ShieldCheck size={25} /><strong>JIDANAO VERIFIED</strong><span>{certificateId}</span></div>
            <div><strong>{grade}</strong><span>Assigned Grade Level</span></div>
          </footer>
        </div>
      </article>
    </div>
  );
}
