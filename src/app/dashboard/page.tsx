import { redirect } from "next/navigation";

/** Legacy path — authenticated app now starts at /jornada. */
export default function DashboardRedirect() {
  redirect("/jornada");
}
