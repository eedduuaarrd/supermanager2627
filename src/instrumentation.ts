export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startMatchLivePoll } = await import("@/lib/match-live-poll");
  startMatchLivePoll();
}
