import { readSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { OnboardingClient } from "./onboarding-client";

export default async function OnboardingPage() {
  const user = await readSession();
  if (!user) redirect("/login");
  return <OnboardingClient />;
}
