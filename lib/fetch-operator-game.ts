import type {
  OperatorDetailsPayload,
  OperatorQueuePayload,
  OperatorShellPayload,
} from "@/lib/operator-payload";

export type OperatorGameScope = "shell" | "queue" | "live" | "details" | "full";

export async function fetchOperatorGame(gameId: string, scope: OperatorGameScope) {
  const response = await fetch(`/api/games/${gameId}?scope=${scope}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message);
  return data;
}

export async function fetchOperatorShell(gameId: string) {
  return (await fetchOperatorGame(gameId, "shell")) as OperatorShellPayload;
}

export async function fetchOperatorQueue(gameId: string) {
  return (await fetchOperatorGame(gameId, "queue")) as OperatorQueuePayload;
}

export async function fetchOperatorDetails(gameId: string) {
  return (await fetchOperatorGame(gameId, "details")) as OperatorDetailsPayload;
}
