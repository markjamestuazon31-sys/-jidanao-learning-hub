import { Award, Download, GraduationCap, LoaderCircle, LockKeyhole, Medal, Sparkles, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import StudentBadge from "../components/student/StudentBadge";
import VoiceSettings from "../components/student/VoiceSettings";
import { useAuth } from "../context/AuthContext";
import { deriveBadges, getGradeExperience, systemCatalogForGrade } from "../data/gradeExperience";
import {
  normalizeProgress,
  subscribeStudentCertificates,
  subscribeUserProgress,
} from "../services/dataService";
import { generateCertificate } from "../utils/pdf";

function normalizeCertificates(node) {
  if (!node || typeof node !== "object") return [];
  return Object.entries(node).map(([id, value]) => ({ id, ...value }));
}

export default function StudentAchievements() {
  const { user, profile } = useAuth();
  const [progress, setProgress] = useState(() => normalizeProgress({}));
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const experience = getGradeExperience(profile?.gradeLevel);

  useEffect(() => {
    if (!user?.uid) return undefined;
    let progressReady = false;
    let certificateReady = false;
    const finish = () => {
      if (progressReady && certificateReady) setLoading(false);
    };
    const unsubscribeProgress = subscribeUserProgress(user.uid, (value) => {
      setProgress(value);
      progressReady = true;
      finish();
    }, (loadError) => {
      setError(loadError.message || "Unable to load achievements.");
      progressReady = true;
      finish();
    });
    const unsubscribeCertificates = subscribeStudentCertificates(user.uid, (value) => {
      setCertificates(normalizeCertificates(value));
      certificateReady = true;
      finish();
    }, () => {
      certificateReady = true;
      finish();
    });
    return () => {
      unsubscribeProgress();
      unsubscribeCertificates();
    };
  }, [user?.uid]);

  const badges = useMemo(() => deriveBadges(progress.summary), [progress.summary]);
  const unlocked = badges.filter((badge) => badge.unlocked);
  const canGenerateMilestone = progress.summary.lessonsCompleted >= 1;
  const cameraCertificates = useMemo(
    () => systemCatalogForGrade(profile?.gradeLevel)
      .filter((game) => game.certificateTrack)
      .map((game) => ({ ...game, earned: Boolean(progress.game?.[game.id]?.certificateEligible) })),
    [profile?.gradeLevel, progress.game],
  );

  return (
    <div className={`student-portal student-achievements-page student-theme--${experience.theme}`}>
      <header className="student-page-hero">
        <div className="student-page-hero__icon"><Award size={30} /></div>
        <div><span>{profile?.gradeLevel} ACHIEVEMENT CENTER</span><h1>Badges & certificates</h1><p>Celebrate learning milestones earned through lessons, quizzes, games, streaks, and camera challenges.</p></div>
        <div className="student-page-hero__tools"><VoiceSettings compact /><strong>{unlocked.length}/{badges.length}</strong><small>badges unlocked</small></div>
      </header>

      {loading ? (
        <div className="student-state-card"><LoaderCircle className="spin" size={30} /><div><strong>Opening your achievement center…</strong><p>Checking saved milestones and verified certificates.</p></div></div>
      ) : error ? (
        <div className="student-state-card student-state-card--error"><Award size={30} /><div><strong>Achievements could not be loaded.</strong><p>{error}</p></div></div>
      ) : (
        <>
          <section className="student-achievement-hero">
            <div className="student-achievement-hero__trophy"><Trophy size={62} /></div>
            <div><span>YOUR COLLECTION</span><h2>{unlocked.length} badges unlocked</h2><p>Level {progress.summary.level} • {progress.summary.totalXp} XP • {progress.summary.currentStreak}-day streak</p></div>
            <div className="student-achievement-hero__progress"><div><span style={{ width: `${Math.round((unlocked.length / badges.length) * 100)}%` }} /></div><small>{badges.length - unlocked.length} badges left to discover</small></div>
          </section>

          <section className="student-section-block">
            <div className="student-section-heading"><div><span className="student-section-kicker">REWARD COLLECTION</span><h2>Learning badges</h2><p>Every badge is unlocked from real progress saved in Realtime Database.</p></div></div>
            <div className="student-badge-grid student-badge-grid--large">
              {badges.map((badge) => <StudentBadge key={badge.id} badge={badge} />)}
            </div>
          </section>

          <section className="student-certificate-grid">
            {cameraCertificates.map((certificate) => (
              <article className={`student-certificate-card ${certificate.earned ? "is-unlocked" : "is-locked"}`} key={certificate.id}>
                <div className="student-certificate-card__seal">{certificate.earned ? <GraduationCap size={34} /> : <LockKeyhole size={30} />}</div>
                <div><span>LEVEL 10 CERTIFICATE</span><h2>{certificate.title}</h2><p>{certificate.earned ? "All ten levels completed. Your printable certificate is ready." : "Complete and pass Level 10 to unlock this certificate."}</p></div>
                {certificate.earned ? (
                  <Link to={`/student/camera-certificate/${certificate.certificateTrack}`}><Download size={17} /> Open certificate</Link>
                ) : (
                  <Link to={certificate.route}>Continue levels</Link>
                )}
              </article>
            ))}

            <article className={`student-certificate-card ${canGenerateMilestone ? "is-unlocked" : "is-locked"}`}>
              <div className="student-certificate-card__seal">{canGenerateMilestone ? <Medal size={34} /> : <LockKeyhole size={30} />}</div>
              <div><span>SYSTEM MILESTONE</span><h2>Learning Achievement Certificate</h2><p>Unlocked after completing at least one teacher-approved lesson.</p></div>
              <button
                type="button"
                disabled={!canGenerateMilestone}
                onClick={() => generateCertificate({
                  studentName: profile?.name,
                  title: `${progress.summary.lessonsCompleted} completed Jidanao Learning Hub lesson${progress.summary.lessonsCompleted === 1 ? "" : "s"}`,
                })}
              >
                <Download size={17} /> Generate PDF
              </button>
            </article>

            {certificates.map((certificate) => (
              <article className="student-certificate-card is-unlocked" key={certificate.id}>
                <div className="student-certificate-card__seal"><Sparkles size={32} /></div>
                <div><span>VERIFIED CERTIFICATE</span><h2>{certificate.title || "Learning Milestone"}</h2><p>{certificate.description || "Issued by Jidanao Elementary School."}</p></div>
                {certificate.url ? (
                  <a href={certificate.url} target="_blank" rel="noreferrer noopener"><Download size={17} /> Open certificate</a>
                ) : (
                  <button type="button" onClick={() => generateCertificate({ studentName: profile?.name, title: certificate.title || "a verified learning milestone" })}><Download size={17} /> Generate PDF</button>
                )}
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
