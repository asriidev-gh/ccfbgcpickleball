export type DemoVideoId =
  | "player-registration"
  | "game-dashboard"
  | "match-history"
  | "leaderboard";

export type DemoVideoOption = {
  id: DemoVideoId;
  title: string;
  description?: string;
  /** One or more videos played in order when the option is selected. */
  sources: string[];
};

export const DEMO_VIDEO_OPTIONS: DemoVideoOption[] = [
  {
    id: "player-registration",
    title: "Player Registration",
    sources: [
      "/assets/videos/demo/qr_code.mp4",
      "/assets/videos/demo/player_registration.webm",
    ],
  },
  {
    id: "game-dashboard",
    title: "Game Dashboard",
    description: "Court filling, shuffle players, ending game",
    sources: [
      "/assets/videos/demo/game_dashboard_filling_court_shuffling_players_ending_game.webm",
    ],
  },
  {
    id: "match-history",
    title: "Match history",
    description:
      "Editing match score, checking out player, replacing player",
    sources: [
      "/assets/videos/demo/match_history_editing_match_score_checking_out_player_replacing_player.webm",
    ],
  },
  {
    id: "leaderboard",
    title: "Leaderboard",
    sources: ["/assets/videos/demo/leaderboard.webm"],
  },
];

export function getDemoVideoById(id: DemoVideoId) {
  return DEMO_VIDEO_OPTIONS.find((option) => option.id === id);
}
