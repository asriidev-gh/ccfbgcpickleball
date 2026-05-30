/** Matches in-app demo titles ("Test Open Play N") and seed ("Demo Open Play"). */
export const DEMO_OPEN_PLAY_TITLE = /^(test|demo) open play/i;

export function isDemoOpenPlayTitle(title: string) {
  return DEMO_OPEN_PLAY_TITLE.test(title.trim());
}
