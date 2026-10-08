import { notFound } from "next/navigation";
import RegistrationApp from "@/components/registration-app";
export function generateStaticParams() {
  return [{ view: "login" }, { view: "register" }, { view: "teams" }];
}
export default async function Page({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  if (view !== "login" && view !== "register" && view !== "teams") notFound();
  return <RegistrationApp initialView={view} />;
}
