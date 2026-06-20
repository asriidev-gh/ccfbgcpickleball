import { capitalizeNameWords, formatPlayerDisplayName } from "@/lib/utils";

const DEFAULT_PAUSE_MS = 500;
const COURT_INTRO_PAUSE_MS = 500;
const VS_PAUSE_MS = 300;
const DEFAULT_REPEAT_PAUSE_MS = 1000;
const SYNTH_RESET_MS = 100;
const CHROME_KEEP_ALIVE_MS = 10_000;
const DEFAULT_SPEECH_RATE = 0.95;
const DEFAULT_SPEECH_PITCH = 1;
const DEFAULT_SPEECH_VOLUME = 1;
const HAVE_FUN_EXCITED_RATE = 1.15;
const HAVE_FUN_EXCITED_PITCH = 1.4;
export const CALL_NAMES_HAVE_FUN_PHRASE = "Have fun!";
export const CALL_NAMES_VOICE_STORAGE_KEY = "ccf-call-names-voice-uri";
export const CALL_NAMES_NAME_MODE_STORAGE_KEY = "ccf-call-names-name-mode";
export const CALL_NAMES_CALL_COUNT_STORAGE_KEY = "ccf-call-names-call-count";
export const CALL_NAMES_VOLUME_STORAGE_KEY = "ccf-call-names-volume";
export const CALL_NAMES_PREFERRED_VOICE_NAME = "Google US English";
export const DEFAULT_CALL_NAMES_VOLUME = DEFAULT_SPEECH_VOLUME;

export type CallNamesNameMode = "first_name" | "full_name";
export const DEFAULT_CALL_NAMES_NAME_MODE: CallNamesNameMode = "first_name";

export type CallNamesCallCount = 1 | 2;
export const DEFAULT_CALL_NAMES_CALL_COUNT: CallNamesCallCount = 1;

export type CallNamesVoiceOption = {
  voiceURI: string;
  name: string;
  lang: string;
};

export type CallNamesSpeechOptions = {
  pauseMs?: number;
  repeatCount?: number;
  repeatPauseMs?: number;
  volume?: number;
  courtNumber?: number | null;
  onStart?: () => void;
  onComplete?: () => void;
};

type PlayerNameRef = {
  firstName: string;
  lastName: string;
};

export type CallPhraseStep = {
  text: string;
  /** Pause after this phrase before the next one. Defaults to `DEFAULT_PAUSE_MS`. Use `0` for no pause. */
  pauseAfterMs?: number;
  rate?: number;
  pitch?: number;
  volume?: number;
};

function phrase(
  text: string,
  options: Omit<CallPhraseStep, "text"> = {},
): CallPhraseStep {
  return { text, ...options };
}

function formatTeamPlayersPhrase(names: string[]): string {
  const players = names.map((name) => name.trim()).filter(Boolean);
  if (players.length === 0) return "";
  if (players.length === 1) return players[0];
  return players.join(" and ");
}

export function buildTeamAnnouncementPhrases(teamANames: string[], teamBNames: string[]) {
  const teamAPhrase = formatTeamPlayersPhrase(teamANames);
  const teamBPhrase = formatTeamPlayersPhrase(teamBNames);
  const steps: CallPhraseStep[] = [];

  if (!teamAPhrase && !teamBPhrase) {
    return steps;
  }

  if (teamAPhrase && teamBPhrase) {
    steps.push(phrase(teamAPhrase, { pauseAfterMs: 0 }));
    steps.push(phrase("versus", { pauseAfterMs: VS_PAUSE_MS }));
    steps.push(phrase(teamBPhrase, { pauseAfterMs: 0 }));
    return steps;
  }

  const soloPhrase = teamAPhrase || teamBPhrase;
  steps.push(phrase(soloPhrase, { pauseAfterMs: 0 }));
  return steps;
}

/** Court number intro, then team names with selective pauses, then an excited "Have fun!" */
export function buildNextCourtCallIntro(_playerCount: number, courtNumber?: number | null) {
  return courtNumber != null ? `Court ${courtNumber}` : "Court";
}

export function buildNextCourtCallPhrases(names: string[], courtNumber?: number | null) {
  const trimmedNames = names.map((name) => name.trim()).filter(Boolean);
  if (trimmedNames.length === 0) return [];

  const teamSplitIndex = Math.ceil(trimmedNames.length / 2);
  return buildNextCourtCallPhrasesFromTeams(
    trimmedNames.slice(0, teamSplitIndex),
    trimmedNames.slice(teamSplitIndex),
    courtNumber,
  );
}

export function buildNextCourtCallPhrasesFromTeams(
  teamANames: string[],
  teamBNames: string[],
  courtNumber?: number | null,
): CallPhraseStep[] {
  const teamA = teamANames.map((name) => name.trim()).filter(Boolean);
  const teamB = teamBNames.map((name) => name.trim()).filter(Boolean);
  const playerCount = teamA.length + teamB.length;
  if (playerCount === 0) return [];

  const steps: CallPhraseStep[] = [
    phrase(buildNextCourtCallIntro(playerCount, courtNumber), { pauseAfterMs: COURT_INTRO_PAUSE_MS }),
    ...buildTeamAnnouncementPhrases(teamA, teamB),
    phrase(CALL_NAMES_HAVE_FUN_PHRASE, {
      pauseAfterMs: 0,
      rate: HAVE_FUN_EXCITED_RATE,
      pitch: HAVE_FUN_EXCITED_PITCH,
    }),
  ];

  return steps;
}

function formatCallNamePlayer(
  player: PlayerNameRef,
  rank: number | undefined,
  mode: CallNamesNameMode,
): string {
  const fullName = formatPlayerDisplayName(player.firstName, player.lastName, rank);
  if (mode === "full_name") return fullName;
  if (fullName.startsWith("Rank ")) return fullName;
  const firstName = capitalizeNameWords(player.firstName).trim();
  return firstName || fullName;
}

export function loadCallNamesNameMode(): CallNamesNameMode {
  if (typeof window === "undefined") return DEFAULT_CALL_NAMES_NAME_MODE;
  const stored = localStorage.getItem(CALL_NAMES_NAME_MODE_STORAGE_KEY);
  return stored === "full_name" ? "full_name" : DEFAULT_CALL_NAMES_NAME_MODE;
}

export function saveCallNamesNameMode(mode: CallNamesNameMode) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CALL_NAMES_NAME_MODE_STORAGE_KEY, mode);
}

export function loadCallNamesCallCount(): CallNamesCallCount {
  if (typeof window === "undefined") return DEFAULT_CALL_NAMES_CALL_COUNT;
  const stored = localStorage.getItem(CALL_NAMES_CALL_COUNT_STORAGE_KEY);
  return stored === "2" ? 2 : DEFAULT_CALL_NAMES_CALL_COUNT;
}

export function saveCallNamesCallCount(count: CallNamesCallCount) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CALL_NAMES_CALL_COUNT_STORAGE_KEY, String(count));
}

function clampSpeechVolume(volume: number) {
  if (!Number.isFinite(volume)) return DEFAULT_CALL_NAMES_VOLUME;
  return Math.min(1, Math.max(0, volume));
}

export function loadCallNamesVolume() {
  if (typeof window === "undefined") return DEFAULT_CALL_NAMES_VOLUME;
  const stored = localStorage.getItem(CALL_NAMES_VOLUME_STORAGE_KEY);
  if (!stored) return DEFAULT_CALL_NAMES_VOLUME;
  return clampSpeechVolume(Number(stored));
}

export function saveCallNamesVolume(volume: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CALL_NAMES_VOLUME_STORAGE_KEY, String(clampSpeechVolume(volume)));
}

export function buildNextCourtCallPhrasesFromEntries(
  teamA: PlayerNameRef[],
  teamB: PlayerNameRef[],
  courtNumber?: number | null,
): CallPhraseStep[] {
  const nameMode = loadCallNamesNameMode();
  const teamANames = teamA.map((player, index) =>
    formatCallNamePlayer(player, index + 1, nameMode),
  );
  const teamBNames = teamB.map((player, index) =>
    formatCallNamePlayer(player, teamA.length + index + 1, nameMode),
  );
  return buildNextCourtCallPhrasesFromTeams(teamANames, teamBNames, courtNumber);
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
  step: CallPhraseStep,
  synth: SpeechSynthesis,
  voice: SpeechSynthesisVoice | null,
  defaultVolume: number,
): Promise<boolean> {
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(step.text);
    utterance.rate = step.rate ?? DEFAULT_SPEECH_RATE;
    utterance.pitch = step.pitch ?? DEFAULT_SPEECH_PITCH;
    utterance.volume = step.volume ?? defaultVolume;
    if (voice) utterance.voice = voice;

    utterance.onend = () => resolve(true);
    utterance.onerror = () => resolve(false);
    synth.speak(utterance);
  });
}

function normalizePhraseSteps(phrases: Array<string | CallPhraseStep>): CallPhraseStep[] {
  return phrases
    .map((entry) =>
      typeof entry === "string" ? phrase(entry.trim()) : { ...entry, text: entry.text.trim() },
    )
    .filter((step) => step.text.length > 0);
}

async function speakPhrasesOnce(
  steps: CallPhraseStep[],
  synth: SpeechSynthesis,
  voice: SpeechSynthesisVoice | null,
  defaultPauseMs: number,
  defaultVolume: number,
): Promise<boolean> {
  synth.cancel();
  await delay(SYNTH_RESET_MS);

  const stopKeepAlive = startSpeechKeepAlive(synth);

  try {
    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index];
      const spoken = await speakPhrase(step, synth, voice, defaultVolume);
      if (!spoken) return false;
      if (index < steps.length - 1) {
        const pauseAfter = step.pauseAfterMs ?? defaultPauseMs;
        if (pauseAfter > 0) {
          await delay(pauseAfter);
        }
      }
    }
    return true;
  } finally {
    stopKeepAlive();
  }
}

export function cancelCallNamesSpeech() {
  if (typeof window === "undefined") return;
  window.speechSynthesis?.cancel();
}

export async function callNamesInSequence(
  phrases: Array<string | CallPhraseStep>,
  options: CallNamesSpeechOptions = {},
): Promise<boolean> {
  if (!isCallNamesSpeechSupported()) return false;

  const steps = normalizePhraseSteps(phrases);
  if (steps.length === 0) return false;

  const synth = window.speechSynthesis;
  const pauseMs = options.pauseMs ?? DEFAULT_PAUSE_MS;
  const repeatCount = Math.max(1, options.repeatCount ?? loadCallNamesCallCount());
  const repeatPauseMs = options.repeatPauseMs ?? DEFAULT_REPEAT_PAUSE_MS;
  const volume = clampSpeechVolume(options.volume ?? loadCallNamesVolume());

  synth.cancel();
  options.onStart?.();

  const voice = await resolveVoice(synth);

  try {
    for (let repeat = 0; repeat < repeatCount; repeat += 1) {
      if (repeat > 0) {
        synth.cancel();
        await delay(repeatPauseMs);
      }

      const spoken = await speakPhrasesOnce(steps, synth, voice, pauseMs, volume);
      if (!spoken) return false;
    }

    return true;
  } finally {
    options.onComplete?.();
  }
}

function buildCallNamesVoicePreviewPhrases(): CallPhraseStep[] {
  return [
    phrase(buildNextCourtCallIntro(4, 3), { pauseAfterMs: COURT_INTRO_PAUSE_MS }),
    ...buildTeamAnnouncementPhrases(["Alex", "Jordan"], ["Sam", "Casey"]),
  ];
}

export async function previewCallNamesVoice(
  voiceURI: string,
  volume = DEFAULT_CALL_NAMES_VOLUME,
): Promise<boolean> {
  if (!isCallNamesSpeechSupported() || !voiceURI.trim()) return false;

  const synth = window.speechSynthesis;
  const voices = await waitForSpeechVoices(synth);
  const voice = voices.find((entry) => entry.voiceURI === voiceURI) ?? null;
  if (!voice) return false;

  synth.cancel();
  await delay(SYNTH_RESET_MS);

  const stopKeepAlive = startSpeechKeepAlive(synth);
  try {
    return speakPhrasesOnce(
      buildCallNamesVoicePreviewPhrases(),
      synth,
      voice,
      0,
      clampSpeechVolume(volume),
    );
  } finally {
    stopKeepAlive();
  }
}

export async function announceNextCourtPlayers(
  teamA: PlayerNameRef[],
  teamB: PlayerNameRef[],
  options: CallNamesSpeechOptions = {},
): Promise<boolean> {
  const { courtNumber, ...speechOptions } = options;
  return callNamesInSequence(
    buildNextCourtCallPhrasesFromEntries(teamA, teamB, courtNumber),
    speechOptions,
  );
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
