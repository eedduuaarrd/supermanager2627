/**
 * When to show the in-app notification prompt.
 * The browser permission dialog is only opened from a button tap.
 * Already subscribed, already denied, or dismissed this session → stay quiet.
 */
export type PushPromptPermission =
  | "unknown"
  | "default"
  | "granted"
  | "denied"
  | "unsupported";

export type PushPromptMode = "hidden" | "ask" | "ios-home-screen";

export function decidePushPrompt(input: {
  dismissedThisSession: boolean;
  permission: PushPromptPermission;
  /** null while the device subscription is still being read. */
  hasSubscription: boolean | null;
  /** iPhone or iPad that is not the installed Home Screen app. */
  iosWithoutHomeScreen: boolean;
  /** Install tutorial is up, or still going to open on this visit. */
  blockedByInstall: boolean;
}): PushPromptMode {
  if (input.dismissedThisSession) return "hidden";
  if (input.blockedByInstall) return "hidden";
  if (input.hasSubscription === null || input.hasSubscription) return "hidden";
  if (input.permission === "unknown") return "hidden";
  if (input.permission === "denied" || input.permission === "granted") return "hidden";
  if (input.iosWithoutHomeScreen) return "ios-home-screen";
  if (input.permission === "unsupported") return "hidden";
  return "ask";
}
