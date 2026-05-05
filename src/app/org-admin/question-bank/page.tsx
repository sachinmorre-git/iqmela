import { getCallerPermissions } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { QuestionBankClient } from "./QuestionBankClient";

export const metadata = { title: "Question Bank — IQMela" };

export default async function QuestionBankPage() {
  const perms = await getCallerPermissions();
  if (!perms?.orgId) redirect("/");

  return <QuestionBankClient />;
}
