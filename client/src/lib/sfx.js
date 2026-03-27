import { getServerUrl } from './serverUrl';

const SFX_FILES = {
  buzz1: 'buzz1.wav',
  buzz2: 'buzz2.wav',
  buzz3: 'buzz3.wav',
  buzz4: 'buzz4.wav',
  buzz5: 'buzz5.wav',
};

const audioCache = new Map();
const activePlayers = new Set();

function makeSrc(fileName) {
  const base = getServerUrl();
  return `${base}/audio/${fileName}`;
}

function getAudio(name) {
  if (!SFX_FILES[name]) return null;
  if (audioCache.has(name)) return audioCache.get(name);
  const fileName = SFX_FILES[name];
  const audio = new Audio(makeSrc(fileName));
  audio.preload = 'auto';
  audioCache.set(name, audio);
  return audio;
}

export function playSfx(name) {
  const template = getAudio(name);
  if (!template) return;
  try {
    const audio = template.cloneNode(true);
    audio.volume = 0.5;
    activePlayers.add(audio);
    const cleanup = () => {
      activePlayers.delete(audio);
      audio.removeEventListener('ended', cleanup);
      audio.removeEventListener('error', cleanup);
    };
    audio.addEventListener('ended', cleanup);
    audio.addEventListener('error', cleanup);
    void audio.play().catch(() => cleanup());
  } catch (err) {
    // Ignore autoplay/user-gesture playback restrictions.
  }
}

