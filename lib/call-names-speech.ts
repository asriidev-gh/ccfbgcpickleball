import { formatPlayerDisplayName } from "@/lib/utils";

const DEFAULT_PAUSE_MS = 500;
const DEFAULT_REPEAT_COUNT = 2;
const DEFAULT_REPEAT_PAUSE_MS = 1000;
const SYNTH_RESET_MS = 100;
const CHROME_KEEP_ALIVE_MS = 10_000;
export const CALL_NAMES_VOICE_STORAGE_KEY = "ccf-call-names-voice-uri";
export const CALL_NAMES_PREFERRED_VOICE_NAME = "Google US English";

export type CallNamesVoiceOption = {
  voiceURI: string;
  name: string;
  lang: string;
};

export type CallNamesSpeechOptions = {
  pauseMs?: number;
  repeatCount?: number;
  repeatPauseMs?: number;
  onStart?: () => void;
  onComplete?: () => void;
};

type PlayerNameRef = {
  firstName: string;
  lastName: string;
};

export function buildNextCourtCallIntro(playerCount: number) {
  if (playerCount <= 0) return "";
  if (playerCount === 1) {
    return "Attention! The following player is up next on court.";
  }
  return "Attention! The following players are up next on court.";
}

/** Intro, then team A names, "versus", then team B names (matches fill-court pairing). */
export function buildNextCourtCallPhrases(names: string[]) {
  const trimmedNames = names.map((name) => name.trim()).filter(Boolean);
  if (trimmedNames.length === 0) return [];

  const phrases = [buildNextCourtCallIntro(trimmedNames.length)];

  if (trimmedNames.length === 1) {
    phrases.push(trimmedNames[0]);
    return phrases;
  }

  const teamSplitIndex = Math.ceil(trimmedNames.length / 2);
  const teamA = trimmedNames.slice(0, teamSplitIndex);
  const teamB = trimmedNames.slice(teamSplitIndex);

  phrases.push(...teamA, "versus", ...teamB);
  return phrases;
}

export function buildNextCourtCallPhrasesFromTeams(teamANames: string[], teamBNames: string[]) {
  return buildNextCourtCallPhrases([...teamANames, ...teamBNames]);
}

export function buildNextCourtCallPhrasesFromEntries(
  teamA: PlayerNameRef[],
  teamB: PlayerNameRef[],
) {
  const teamANames = teamA.map((player, index) =>
    formatPlayerDisplayName(player.firstName, player.lastName, index + 1),
  );
  const teamBNames = teamB.map((player, index) =>
    formatPlayerDisplayName(player.firstName, player.lastName, teamA.length + index + 1),
  );
  return buildNextCourtCallPhrasesFromTeams(teamANames, teamBNames);
}

export function isCallNamesSpeechSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function loadCallNamesVoiceURI() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CALL_NAMES_VOICE_STORAGE_KEY);
}

export function saveCallNamesVoiceURI(voiceURI: string) {
  if (typeof window === "undefined") return;
  if (!voiceURI) {
    localStorage.removeItem(CALL_NAMES_VOICE_STORAGE_KEY);
    return;
  }
  localStorage.setItem(CALL_NAMES_VOICE_STORAGE_KEY, voiceURI);
}

function pickEnglishVoice(voices: SpeechSynthesisVoice[]) {
  return (
    voices.find((voice) => voice.lang.startsWith("en") && voice.localService) ??
    voices.find((voice) => voice.lang.startsWith("en")) ??
    null
  );
}

export function findPreferredCallNamesVoice(voices: SpeechSynthesisVoice[]) {
  const englishVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("en"));

  return (
    englishVoices.find((voice) => voice.name === CALL_NAMES_PREFERRED_VOICE_NAME) ??
    englishVoices.find((voice) =>
      voice.name.toLowerCase().includes("google us english"),
    ) ??
    pickEnglishVoice(voices)
  );
}

export function getDefaultCallNamesVoiceURI(voices: CallNamesVoiceOption[]) {
  const preferred =
    voices.find((voice) => voice.name === CALL_NAMES_PREFERRED_VOICE_NAME) ??
    voices.find((voice) => voice.name.toLowerCase().includes("google us english"));

  return preferred?.voiceURI ?? voices[0]?.voiceURI ?? null;
}

export function resolveStoredCallNamesVoiceURI(voices: CallNamesVoiceOption[]) {
  const savedURI = loadCallNamesVoiceURI();
  if (savedURI && voices.some((voice) => voice.voiceURI === savedURI)) {
    return savedURI;
  }
  return getDefaultCallNamesVoiceURI(voices);
}

export function listEnglishCallNamesVoices(
  voices: SpeechSynthesisVoice[],
): CallNamesVoiceOption[] {
  const seen = new Set<string>();

  return voices
    .filter((voice) => voice.lang.toLowerCase().startsWith("en"))
    .filter((voice) => {
      if (seen.has(voice.voiceURI)) return false;
      seen.add(voice.voiceURI);
      return true;
    })
    .map((voice) => ({
      voiceURI: voice.voiceURI,
      name: voice.name,
      lang: voice.lang,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function waitForSpeechVoices(synth: SpeechSynthesis) {
  const pollDelaysMs = [0, 50, 150, 350, 750, 1500, 2500];

  return new Promise<SpeechSynthesisVoice[]>((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) return;
      const voices = synth.getVoices();
      if (voices.length === 0) return;
      settled = true;
      synth.removeEventListener("voiceschanged", onVoicesChanged);
      for (const timeoutId of timeoutIds) {
        window.clearTimeout(timeoutId);
      }
      resolve(voices);
    };

    const onVoicesChanged = () => finish();
    const timeoutIds: number[] = [];

    synth.addEventListener("voiceschanged", onVoicesChanged);

    for (const delayMs of pollDelaysMs) {
      timeoutIds.push(
        window.setTimeout(() => {
          synth.getVoices();
          finish();
        }, delayMs),
      );
    }

    window.setTimeout(() => {
      if (settled) return;
      settled = true;
      synth.removeEventListener("voiceschanged", onVoicesChanged);
      for (const timeoutId of timeoutIds) {
        window.clearTimeout(timeoutId);
      }
      resolve(synth.getVoices());
    }, 3000);
  });
}

export function primeCallNamesVoices() {
  if (!isCallNamesSpeechSupported()) return;

  const synth = window.speechSynthesis;
  synth.getVoices();
  if (synth.getVoices().length > 0) return;

  const utterance = new SpeechSynthesisUtterance("");
  utterance.volume = 0;
  synth.speak(utterance);
  synth.cancel();
  synth.getVoices();
}

export function subscribeCallNamesVoices(onVoices: (voices: CallNamesVoiceOption[]) => void) {
  if (!isCallNamesSpeechSupported()) return () => {};

  const synth = window.speechSynthesis;
  let cancelled = false;
  const timeoutIds: number[] = [];

  const refresh = () => {
    if (cancelled) return;
    primeCallNamesVoices();
    const listed = listEnglishCallNamesVoices(synth.getVoices());
    onVoices(listed);
  };

  refresh();
  synth.addEventListener("voiceschanged", refresh);
  primeCallNamesVoices();

  for (const delayMs of [100, 300, 600, 1200, 2000, 3500]) {
    timeoutIds.push(window.setTimeout(refresh, delayMs));
  }

  return () => {
    cancelled = true;
    synth.removeEventListener("voiceschanged", refresh);
    for (const timeoutId of timeoutIds) {
      window.clearTimeout(timeoutId);
    }
  };
}

async function resolveVoice(synth: SpeechSynthesis) {
  const voices = await waitForSpeechVoices(synth);
  const savedURI = loadCallNamesVoiceURI();

  if (savedURI) {
    const saved = voices.find((voice) => voice.voiceURI === savedURI);
    if (saved) return saved;
  }

  return findPreferredCallNamesVoice(voices);
}

function startSpeechKeepAlive(synth: SpeechSynthesis) {
  const interval = window.setInterval(() => {
    if (!synth.speaking && !synth.pending) return;
    synth.pause();
    synth.resume();
  }, CHROME_KEEP_ALIVE_MS);

  return () => window.clearInterval(interval);
}

function speakPhrase(
  text: string,
  synth: SpeechSynthesis,
  voice: SpeechSynthesisVoice | null,
): Promise<boolean> {
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    if (voice) utterance.voice = voice;

    utterance.onend = () => resolve(true);
    utterance.onerror = () => resolve(false);
    synth.speak(utterance);
  });
}

async function speakPhrasesOnce(
  phrases: string[],
  synth: SpeechSynthesis,
  voice: SpeechSynthesisVoice | null,
  pauseMs: number,
): Promise<boolean> {
  synth.cancel();
  await delay(SYNTH_RESET_MS);

  const stopKeepAlive = startSpeechKeepAlive(synth);

  try {
    for (let index = 0; index < phrases.length; index += 1) {
      const spoken = await speakPhrase(phrases[index], synth, voice);
      if (!spoken) return false;
      if (index < phrases.length - 1) {
        await delay(pauseMs);
      }
    }
    return true;
  } finally {
    stopKeepAlive();
  }
}

export async function callNamesInSequence(
  phrases: string[],
  options: CallNamesSpeechOptions = {},
): Promise<boolean> {
  if (!isCallNamesSpeechSupported()) return false;

  const trimmedPhrases = phrases.map((phrase) => phrase.trim()).filter(Boolean);
  if (trimmedPhrases.length === 0) return false;

  const synth = window.speechSynthesis;
  const pauseMs = options.pauseMs ?? DEFAULT_PAUSE_MS;
  const repeatCount = Math.max(1, options.repeatCount ?? DEFAULT_REPEAT_COUNT);
  const repeatPauseMs = options.repeatPauseMs ?? DEFAULT_REPEAT_PAUSE_MS;

  synth.cancel();
  options.onStart?.();

  const voice = await resolveVoice(synth);

  try {
    for (let repeat = 0; repeat < repeatCount; repeat += 1) {
      if (repeat > 0) {
        synth.cancel();
        await delay(repeatPauseMs);
      }

      const spoken = await speakPhrasesOnce(trimmedPhrases, synth, voice, pauseMs);
      if (!spoken) return false;
    }

    return true;
  } finally {
    options.onComplete?.();
  }
}

export async function announceNextCourtPlayers(
  teamA: PlayerNameRef[],
  teamB: PlayerNameRef[],
  options: CallNamesSpeechOptions = {},
): Promise<boolean> {
  return callNamesInSequence(buildNextCourtCallPhrasesFromEntries(teamA, teamB), options);
}

export function buildCourtEndedPhrase(courtNumber: number) {
  return `Court ${courtNumber} has ended!`;
}

export async function announceCourtEnded(
  courtNumber: number,
  options: CallNamesSpeechOptions = {},
): Promise<boolean> {
  return callNamesInSequence([buildCourtEndedPhrase(courtNumber)], {
    repeatCount: 1,
    ...options,
  });
}
