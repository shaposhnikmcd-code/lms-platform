import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/");
  }

  const activeRole = session.user.activeRole ?? session.user.role;

  switch (activeRole) {
    case "ADMIN":
      redirect("/dashboard/admin");
    case "MANAGER":
      redirect("/dashboard/manager");
    case "TEACHER":
      redirect("/dashboard/teacher");
    case "STUDENT":
    default:
      redirect("/dashboard/student");
  }
}