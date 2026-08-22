import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function NewArchiveVideoPage() { redirect("/archive/admin/new"); }
