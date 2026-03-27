import { getServerUrl } from './serverUrl';

const SFX_FILES = {
  username_success: 'username_success.wav',
  lobby_success: 'lobby_success.wav',
  lobby_fail: 'lobby_fail.wav',
  clue_clicked: 'clue_clicked.wav',
  daily_double: 'daily_double.wav',
  round_done: 'round_done.wav',
  next_round: 'next_round.wav',
  rankings: 'rankings.wav',
  buzz1: 'buzz1.wav',
  buzz2: 'buzz2.wav',
  buzz3: 'buzz3.wav',
  buzz4: 'buzz4.wav',
  buzz5: 'buzz5.wav',
};

const audioCache = new Map();

function makeSrc(fileName) {
  const base = getServerUrl();
  return `${base}/audio/${fileName}`;
}

function getAudio(name) {
  if (audioCache.has(name)) return audioCache.get(name);
  const fileName = SFX_FILES[name];
  if (!fileName) return null;
  const audio = new Audio(makeSrc(fileName));
  audio.preload = 'auto';
  audioCache.set(name, audio);
  return audio;
}

export function playSfx(name) {
  const audio = getAudio(name);
  if (!audio) return;
  try {
    audio.currentTime = 0;
    void audio.play();
  } catch (err) {
    // Ignore autoplay/user-gesture playback restrictions.
  }
}

