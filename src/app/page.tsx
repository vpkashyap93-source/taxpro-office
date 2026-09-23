import { redirect } from "next/navigation";
import { getAuth } from "@/server/auth";

export default async function Home() {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  redirect(auth.user.role === "Client" ? "/portal" : "/dashboard");
}
