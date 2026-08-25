import { Accessibility, Headphones, ShieldCheck, SlidersHorizontal } from "lucide-react";
import VoiceSettings from "../components/student/VoiceSettings";

export default function StudentSettings() {
  return (
    <div className="student-portal student-settings-page">
      <section className="student-page-hero student-settings-hero">
        <div>
          <span className="student-section-kicker">LEARNING SETTINGS</span>
          <h1>Make Jidanao comfortable for you</h1>
          <p>Adjust narration, sound, music, and motion preferences for lessons and games.</p>
        </div>
        <span className="student-profile-privacy"><SlidersHorizontal size={17} /> Personal learning preferences</span>
      </section>

      <section className="student-settings-grid">
        <article className="student-dashboard-panel student-settings-card">
          <span className="student-settings-card__icon"><Headphones size={24} /></span>
          <h2>Voice & sound</h2>
          <p>Choose narration style and preview how your learning assistant sounds.</p>
          <VoiceSettings />
        </article>
        <article className="student-dashboard-panel student-settings-card">
          <span className="student-settings-card__icon"><Accessibility size={24} /></span>
          <h2>Accessible learning</h2>
          <p>Reduce animation in the Voice & sound panel when you prefer a calmer interface.</p>
        </article>
        <article className="student-dashboard-panel student-settings-card">
          <span className="student-settings-card__icon"><ShieldCheck size={24} /></span>
          <h2>Privacy</h2>
          <p>Your learning settings stay on your device. Camera game video is not saved as part of this dashboard.</p>
        </article>
      </section>
    </div>
  );
}
