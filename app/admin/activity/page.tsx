import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export default function ActivityPage() { redirect("/archive/admin/activity"); }
