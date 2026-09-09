import {
  Award,
  BookOpenCheck,
  Camera,
  CheckCircle2,
  Gamepad2,
  GraduationCap,
  Mail,
  PenLine,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { onValue, ref } from "firebase/database";
import ProfileAvatar from "../components/ProfileAvatar";
import { useAuth } from "../context/AuthContext";
import { useSchoolStructure } from "../context/SchoolStructureContext";
import { database } from "../firebase/firebaseConfig";
import { activeGradeOptions, sectionsForGrade } from "../data/schoolClasses";
import { normalizeProgress, subscribeUserProgress } from "../services/dataService";
import {
  PROFILE_PHOTO_ACCEPT,
  prepareStudentProfilePhoto,
  removeStudentProfilePhoto,
  uploadStudentProfilePhoto,
} from "../services/profilePhotoService";
import { updateStudentProfileAccount } from "../services/authService";
import { getPublishedAnnouncements } from "../services/adminOperationsService";
import "../styles/student-profile.css";

function ProfileFact({ icon: Icon, label, value }) {
  return (
    <div className="student-profile-fact">
      <span><Icon size={17} /></span>
      <div><small>{label}</small><strong>{value || "—"}</strong></div>
    </div>
  );
}

export default function StudentProfile() {
  const { user, profile, refreshProfile } = useAuth();
  const { structure } = useSchoolStructure();
  const [progress, setProgress] = useState(() => normalizeProgress({}));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [hasPhoto, setHasPhoto] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [form, setForm] = useState({ name: profile?.name || "" });
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!profile) return;
    setForm({
      name: profile.name || "",
    });
  }, [profile]);

  useEffect(() => {
    let active = true;
    async function loadAnnouncements() {
      try {
        const nextAnnouncements = await getPublishedAnnouncements({
          role: "student",
          grade: profile?.gradeLevel,
          section: profile?.section,
        });
        if (active) setAnnouncements(nextAnnouncements);
      } catch (error) {
        console.warn("Unable to load student profile announcements:", error);
        if (active) setAnnouncements([]);
      }
    }

    if (profile) {
      void loadAnnouncements();
    } else {
      setAnnouncements([]);
    }

    return () => {
      active = false;
    };
  }, [profile?.gradeLevel, profile?.section, profile]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    return subscribeUserProgress(user.uid, setProgress, (error) => {
      console.error("Unable to load profile learning summary:", error);
    });
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    return onValue(ref(database, `profilePhotos/${user.uid}`), (snapshot) => {
      setHasPhoto(snapshot.exists() && Boolean(snapshot.val()?.dataUrl));
    });
  }, [user?.uid]);

  async function previewPhoto(file) {
    if (!file || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const prepared = await prepareStudentProfilePhoto(file);
      setPendingPhoto(prepared);
      setMessageType("success");
      setMessage("Preview ready. Choose Save picture to use it across your Jidanao account.");
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Your profile picture could not be prepared.");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function savePhoto() {
    if (!pendingPhoto || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await uploadStudentProfilePhoto(user.uid, pendingPhoto);
      setPendingPhoto(null);
      setMessageType("success");
      setMessage("Your profile picture was updated. Teachers and administrators now see the same photo.");
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Your profile picture could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto() {
    if (!hasPhoto || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await removeStudentProfilePhoto(user.uid);
      setPendingPhoto(null);
      setMessageType("success");
      setMessage("Your profile picture was removed. Your initials will be shown instead.");
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Your profile picture could not be removed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProfileChanges(event) {
    event.preventDefault();
    if (!user?.uid || busy) return;
    setBusy(true);
    setMessage("");

    try {
      await updateStudentProfileAccount({
        uid: user.uid,
        name: form.name,
      });
      await refreshProfile();
      setMessageType("success");
      setMessage("Your learner account details were updated.");
      setIsEditing(false);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Your account details could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  const summary = progress.summary;

  return (
    <div className="student-portal student-profile-page">
      <section className="student-page-hero student-profile-hero">
        <span className="student-page-hero__icon student-profile-hero__icon"><GraduationCap size={30} /></span>
        <div className="student-profile-hero__copy">
          <span className="student-section-kicker">MY PROFILE</span>
          <h1>Your learning identity</h1>
          <p>Choose a clear profile picture so your teachers and school administrators can recognize your learner profile.</p>
        </div>
        <span className="student-profile-privacy"><ShieldCheck size={17} /> School account profile</span>
      </section>

      {message && <div className={`student-profile-message is-${messageType}`} role="status">{message}</div>}

      <section className="student-profile-layout">
        <article className="student-profile-photo-card">
          <div className="student-profile-card-kicker"><ShieldCheck size={15} /> VERIFIED SCHOOL PROFILE</div>
          <div className="student-profile-photo-card__halo">
            <ProfileAvatar
              uid={user?.uid}
              name={profile?.name}
              photoDataUrl={pendingPhoto?.dataUrl}
              size={148}
            />
            <span className="student-profile-camera-badge"><Camera size={18} /></span>
          </div>

          <div className="student-profile-photo-card__copy">
            <span>{[profile?.gradeLevel, profile?.section].filter(Boolean).join(" · ") || "Student"}</span>
            <h2>{profile?.name || "Learner"}</h2>
            <p>{profile?.email || user?.email || "School learner account"}</p>
          </div>

          <div className="student-profile-status-row">
            <span><CheckCircle2 size={15} /> {profile?.status === "disabled" ? "Account disabled" : "Active learner"}</span>
            <span><Sparkles size={15} /> Level {summary.level}</span>
          </div>

          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            accept={PROFILE_PHOTO_ACCEPT}
            onChange={(event) => previewPhoto(event.target.files?.[0])}
          />

          <div className="student-profile-photo-card__actions">
            {pendingPhoto ? (
              <>
                <button type="button" className="student-profile-upload" onClick={savePhoto} disabled={busy}>
                  <CheckCircle2 size={17} /> {busy ? "Saving…" : "Save picture"}
                </button>
                <button type="button" className="student-profile-remove" onClick={() => setPendingPhoto(null)} disabled={busy}>
                  <X size={16} /> Cancel
                </button>
              </>
            ) : (
              <button type="button" className="student-profile-upload" onClick={() => fileInputRef.current?.click()} disabled={busy}>
                <Upload size={17} /> {busy ? "Preparing…" : hasPhoto ? "Change picture" : "Add picture"}
              </button>
            )}
            {hasPhoto && !pendingPhoto && (
              <button type="button" className="student-profile-remove" onClick={removePhoto} disabled={busy}>
                <Trash2 size={16} /> Remove
              </button>
            )}
          </div>

          <p className="student-profile-photo-help">JPG, PNG, or WebP. Your photo is automatically cropped, resized, and optimized for your school profile.</p>

          <div className="student-profile-sharing-note">
            <CheckCircle2 size={17} />
            <span>The same photo appears in your dashboard, top bar, teacher learner list, and administrator student directory.</span>
          </div>
        </article>

        <div className="student-profile-details-column">
          <article className="student-dashboard-panel student-profile-information">
            <div className="student-panel-heading student-profile-panel-heading">
              <div className="student-panel-heading__title">
                <span className="student-panel-icon student-panel-icon--blue"><GraduationCap size={21} /></span>
                <div><small>ACCOUNT DETAILS</small><h2>Learner information</h2></div>
              </div>
              {!isEditing && (
                <button type="button" className="student-profile-edit-toggle" onClick={() => setIsEditing(true)}>
                  <PenLine size={15} /> Edit profile
                </button>
              )}
            </div>

            {isEditing ? (
              <form className="student-profile-edit-form" onSubmit={saveProfileChanges}>
                <label className="student-profile-field">
                  <span>Student name</span>
                  <input
                    required
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  />
                </label>

                <label className="student-profile-field is-readonly">
                  <span>School email</span>
                  <input value={profile?.email || user?.email || ""} readOnly />
                </label>

                <div className="student-profile-form-actions">
                  <button type="submit" className="student-profile-save" disabled={busy || !form.name}>
                    <Save size={16} /> {busy ? "Saving…" : "Save changes"}
                  </button>
                  <button type="button" className="student-profile-cancel" onClick={() => setIsEditing(false)} disabled={busy}>
                    <X size={16} /> Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="student-profile-facts-grid">
                <ProfileFact icon={GraduationCap} label="Grade level" value={profile?.gradeLevel} />
                <ProfileFact icon={Users} label="Section" value={profile?.section || "Not assigned"} />
                <ProfileFact icon={Mail} label="School email" value={profile?.email || user?.email} />
                <ProfileFact icon={ShieldCheck} label="Account status" value={profile?.status === "disabled" ? "Disabled" : "Active"} />
                <ProfileFact icon={Sparkles} label="Learning level" value={`Level ${summary.level}`} />
              </div>
            )}
          </article>

          {announcements.length > 0 && (
            <article className="student-dashboard-panel student-profile-announcements">
              <div className="student-panel-heading">
                <div className="student-panel-heading__title">
                  <span className="student-panel-icon student-panel-icon--blue"><Sparkles size={21} /></span>
                  <div><small>ANNOUNCEMENTS</small><h2>School updates</h2></div>
                </div>
              </div>

              <div className="student-profile-announcement-list">
                {announcements.slice(0, 3).map((item) => (
                  <article key={item.id} className={`student-profile-announcement student-profile-announcement--${item.priority || "normal"}`}>
                    <span className="student-profile-announcement__tag">{String(item.priority || "normal").toUpperCase()}</span>
                    <div className="student-profile-announcement__content">
                      <strong>{item.title}</strong>
                      <p>{item.message}</p>
                    </div>
                  </article>
                ))}
              </div>
            </article>
          )}

          <article className="student-dashboard-panel student-profile-progress-card">
            <div className="student-panel-heading">
              <span className="student-panel-icon student-panel-icon--violet"><Award size={21} /></span>
              <div><small>LEARNING SNAPSHOT</small><h2>Your progress at a glance</h2></div>
            </div>
            <div className="student-profile-stat-row">
              <div><i><Award size={20} /></i><strong>{summary.totalXp}</strong><span>Total XP</span></div>
              <div><i><BookOpenCheck size={20} /></i><strong>{summary.lessonsCompleted}</strong><span>Lessons completed</span></div>
              <div><i><Gamepad2 size={20} /></i><strong>{summary.gameSessions}</strong><span>Games played</span></div>
              <div><i><Target size={20} /></i><strong>{summary.accuracyPercent}%</strong><span>Accuracy</span></div>
            </div>
            <div className="student-profile-progress-note"><Sparkles size={17} /><span>Keep completing lessons, quizzes, and games to grow your XP and unlock more achievements.</span></div>
          </article>
        </div>
      </section>
    </div>
  );
}
