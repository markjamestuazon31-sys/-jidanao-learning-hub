import {
  Award,
  Camera,
  Gamepad2,
  Headphones,
  Star,
  Trophy,
  TrendingUp,
} from "lucide-react";

export default function HomeHeroArtwork() {
  return (
    <div className="home-hero-artwork">
      <span className="home-hero-artwork__halo" aria-hidden="true" />

      <div className="home-hero-platform-card" aria-hidden="true">
        <div className="home-hero-platform-card__top">
          <span>
            <strong>Jidanao learner space</strong>
            <small>My learning today</small>
          </span>
          <span className="home-hero-platform-card__status">
            <span /> Live
          </span>
        </div>
        <div className="home-hero-platform-card__metrics">
          <span><TrendingUp size={17} /><strong>82%</strong><small>Progress</small></span>
          <span><Award size={17} /><strong>Level 4</strong><small>Explorer</small></span>
        </div>
        <div className="home-hero-platform-card__progress">
          <span><i />Keep learning</span>
          <strong>4-day streak</strong>
        </div>
      </div>

      <span className="home-hero-float-card home-hero-float-card--trophy" aria-hidden="true">
        <span><Trophy size={25} /></span>
        <span><small>Achievements</small><strong>Earn rewards</strong></span>
      </span>
      <span className="home-hero-float-card home-hero-float-card--game" aria-hidden="true">
        <span><Camera size={26} /></span>
        <span><small>Camera games</small><strong>Move & learn</strong></span>
      </span>
      <span className="home-hero-float-card home-hero-float-card--book" aria-hidden="true">
        <span><Headphones size={25} /></span>
        <span><small>Reading lab</small><strong>Read aloud</strong></span>
      </span>
      <span className="home-hero-float-card home-hero-float-card--mini" aria-hidden="true">
        <Gamepad2 size={21} />
      </span>
      <span className="home-hero-star home-hero-star--one" aria-hidden="true">
        <Star size={20} fill="currentColor" />
      </span>
      <span className="home-hero-star home-hero-star--two" aria-hidden="true">
        <Star size={14} fill="currentColor" />
      </span>

      <img
        className="home-students-illustration home-students-illustration--professional"
        src="/image/jidanao-hero-students-professional.webp"
        alt="Two Jidanao pupils learning together with a tablet and a book"
        width="1100"
        height="733"
        loading="eager"
        decoding="async"
        fetchPriority="high"
      />
    </div>
  );
}
