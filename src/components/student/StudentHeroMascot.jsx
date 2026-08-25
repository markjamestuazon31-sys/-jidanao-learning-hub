export default function StudentHeroMascot() {
  return (
    <div className="student-hero-mascot" aria-hidden="true">
      <svg viewBox="0 0 320 230" role="presentation">
        <defs>
          <linearGradient id="suit" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#dbe9ff" />
          </linearGradient>
          <linearGradient id="visor" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#78e8ff" />
            <stop offset="1" stopColor="#1688ea" />
          </linearGradient>
          <linearGradient id="book" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff6d8" />
            <stop offset="1" stopColor="#ffd995" />
          </linearGradient>
          <filter id="shadow" x="-30%" y="-30%" width="160%" height="180%">
            <feDropShadow dx="0" dy="10" stdDeviation="9" floodColor="#14256f" floodOpacity=".28" />
          </filter>
        </defs>

        <g opacity=".9">
          <circle cx="34" cy="35" r="3" fill="#fff" />
          <circle cx="280" cy="38" r="4" fill="#ffd75d" />
          <circle cx="255" cy="82" r="2.5" fill="#fff" />
          <path d="M45 90h12M51 84v12" stroke="#ffd75d" strokeWidth="3" strokeLinecap="round" />
          <path d="M278 126h10M283 121v10" stroke="#ff8bd5" strokeWidth="3" strokeLinecap="round" />
        </g>

        <ellipse cx="166" cy="207" rx="105" ry="17" fill="#172b8b" opacity=".2" />

        <g filter="url(#shadow)">
          <path d="M106 143c0-41 25-72 62-72s64 31 64 72v48H106z" fill="url(#suit)" />
          <rect x="125" y="145" width="86" height="62" rx="31" fill="#f8fbff" />
          <rect x="142" y="157" width="53" height="32" rx="13" fill="#1c64cf" opacity=".12" />
          <circle cx="168" cy="92" r="58" fill="#f7fbff" />
          <circle cx="168" cy="92" r="48" fill="#b9dcff" />
          <circle cx="168" cy="92" r="41" fill="url(#visor)" />
          <ellipse cx="154" cy="88" rx="5" ry="8" fill="#113e8c" />
          <ellipse cx="183" cy="88" rx="5" ry="8" fill="#113e8c" />
          <path d="M158 108c7 8 16 8 23 0" fill="none" stroke="#113e8c" strokeWidth="4" strokeLinecap="round" />
          <circle cx="146" cy="101" r="5" fill="#ff8fbd" opacity=".82" />
          <circle cx="191" cy="101" r="5" fill="#ff8fbd" opacity=".82" />
          <path d="M112 145c-21 5-37 17-47 34" stroke="#f7fbff" strokeWidth="19" strokeLinecap="round" />
          <circle cx="62" cy="180" r="13" fill="#2aa1f0" />
          <path d="M224 143c18 5 31 16 39 32" stroke="#f7fbff" strokeWidth="19" strokeLinecap="round" />
          <circle cx="266" cy="178" r="13" fill="#2aa1f0" />
        </g>

        <g transform="translate(79 160)" filter="url(#shadow)">
          <path d="M0 22c35-14 62-12 87 5v37C58 48 31 47 0 57z" fill="url(#book)" />
          <path d="M174 22c-35-14-62-12-87 5v37c29-16 56-17 87-7z" fill="url(#book)" />
          <path d="M87 27v37" stroke="#e8933d" strokeWidth="4" />
          <path d="M18 31c19-6 36-4 53 3M103 34c18-7 35-8 54-3" stroke="#d79f69" strokeWidth="3" opacity=".7" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}
