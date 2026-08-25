let audioContext;
let musicTimer;
let musicStep = 0;
const activeMusicNodes = new Set();

const NOTE = Object.freeze({
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196, A3: 220,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392, A4: 440, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880, B5: 987.77,
  C6: 1046.5,
});

const MUSIC_THEMES = Object.freeze({
  arcade: {
    tempo: 440,
    melody: [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.E5, NOTE.D5, NOTE.F5, NOTE.A5, NOTE.G5],
    bass: [NOTE.C3, NOTE.C3, NOTE.G3, NOTE.G3, NOTE.D3, NOTE.D3, NOTE.G3, NOTE.G3],
    wave: "triangle",
  },
  math: {
    tempo: 420,
    melody: [NOTE.C5, NOTE.G4, NOTE.E5, NOTE.G4, NOTE.D5, NOTE.A4, NOTE.F5, NOTE.A4],
    bass: [NOTE.C3, NOTE.C3, NOTE.E3, NOTE.E3, NOTE.D3, NOTE.D3, NOTE.F3, NOTE.G3],
    wave: "square",
  },
  reading: {
    tempo: 560,
    melody: [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.E5, NOTE.A4, NOTE.D5, NOTE.F5, NOTE.D5],
    bass: [NOTE.C3, NOTE.C3, NOTE.A3, NOTE.A3, NOTE.F3, NOTE.F3, NOTE.G3, NOTE.G3],
    wave: "sine",
  },
});

function context() {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  audioContext ||= new AudioContextClass();
  if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
  return audioContext;
}

function tone({ frequency, duration, volume, type = "sine", delay = 0, attack = 0.012, music = false, detune = 0 }) {
  const ctx = context();
  if (!ctx || !frequency || !volume) return;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const start = ctx.currentTime + Math.max(0, delay);
  const end = start + Math.max(0.03, duration);
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.detune.setValueAtTime(detune, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(end + 0.03);
  if (music) {
    activeMusicNodes.add(oscillator);
    oscillator.addEventListener("ended", () => activeMusicNodes.delete(oscillator), { once: true });
  }
}

function sequence(notes, volume) {
  notes.forEach(([frequency, duration, delay, type = "sine", gain = 1, detune = 0]) => {
    tone({ frequency, duration, delay, type, volume: volume * gain, detune });
  });
}

export function playGameSound(name, volume = 0.35) {
  const v = Math.max(0, Math.min(0.65, Number(volume) || 0));
  if (!v) return;
  const sounds = {
    button: [[NOTE.A4, .07, 0, "sine", .45], [NOTE.E5, .08, .045, "sine", .35]],
    select: [[NOTE.E5, .065, 0, "triangle", .42]],
    start: [[NOTE.C5, .10, 0, "triangle", .58], [NOTE.E5, .12, .08, "triangle", .62], [NOTE.G5, .18, .17, "triangle", .68]],
    grab: [[NOTE.D5, .07, 0, "square", .32], [NOTE.A5, .09, .05, "sine", .38]],
    drop: [[NOTE.G5, .06, 0, "triangle", .42], [NOTE.C5, .12, .045, "triangle", .36]],
    record: [[NOTE.A4, .08, 0, "sine", .42], [NOTE.C5, .11, .07, "sine", .45]],
    stop: [[NOTE.C5, .08, 0, "sine", .36], [NOTE.A4, .10, .055, "sine", .32]],
    tick: [[NOTE.C5, .045, 0, "square", .14]],
    correct: [[NOTE.C5, .11, 0, "triangle", .62], [NOTE.E5, .12, .085, "triangle", .66], [NOTE.G5, .19, .17, "sine", .72]],
    streak: [[NOTE.E5, .09, 0, "triangle", .55], [NOTE.G5, .11, .07, "triangle", .62], [NOTE.B5, .13, .14, "sine", .70], [NOTE.C6, .22, .23, "sine", .72]],
    wrong: [[NOTE.D4, .13, 0, "triangle", .50], [NOTE.A3, .23, .10, "triangle", .42]],
    timeout: [[NOTE.E4, .10, 0, "square", .36], [NOTE.C4, .16, .09, "square", .32], [NOTE.A3, .24, .20, "triangle", .30]],
    level: [[NOTE.G4, .09, 0, "triangle", .50], [NOTE.C5, .11, .08, "triangle", .58], [NOTE.E5, .13, .17, "triangle", .64], [NOTE.G5, .28, .28, "sine", .70]],
    achievement: [[NOTE.C5, .10, 0, "triangle", .55], [NOTE.E5, .12, .08, "triangle", .62], [NOTE.G5, .14, .17, "triangle", .68], [NOTE.C6, .36, .28, "sine", .76]],
  };
  sequence(sounds[name] || sounds.button, v);
}

function playMusicStep(themeName, volume) {
  const theme = MUSIC_THEMES[themeName] || MUSIC_THEMES.arcade;
  const step = musicStep % theme.melody.length;
  const mainVolume = Math.max(0, Math.min(.12, volume));
  tone({ frequency: theme.melody[step], duration: theme.tempo / 1000 * .70, volume: mainVolume, type: theme.wave, music: true });
  if (step % 2 === 0) {
    tone({ frequency: theme.bass[step], duration: theme.tempo / 1000 * 1.45, volume: mainVolume * .48, type: "sine", music: true });
  }
  if (step === 3 || step === 7) {
    tone({ frequency: theme.melody[step] * 2, duration: .06, volume: mainVolume * .18, type: "square", music: true });
  }
  musicStep += 1;
}

export function startBackgroundMusic(volume = 0.07, themeName = "arcade") {
  stopBackgroundMusic();
  const theme = MUSIC_THEMES[themeName] || MUSIC_THEMES.arcade;
  const safeVolume = Math.max(0, Math.min(.12, Number(volume) || 0));
  if (!safeVolume) return stopBackgroundMusic;
  playMusicStep(themeName, safeVolume);
  musicTimer = window.setInterval(() => playMusicStep(themeName, safeVolume), theme.tempo);
  return stopBackgroundMusic;
}

export function stopBackgroundMusic() {
  if (musicTimer) window.clearInterval(musicTimer);
  musicTimer = undefined;
  musicStep = 0;
  activeMusicNodes.forEach((node) => {
    try { node.stop(); } catch { /* The note may already have ended. */ }
  });
  activeMusicNodes.clear();
}
