import { SiteFooter, SiteHeader } from "../../components/SiteChrome";
import { requireAdminPage } from "../../admin-auth";
import MigrationImport from "./MigrationImport";

export default async function MigrationPage() {
  await requireAdminPage();
  return (
    <>
      <SiteHeader />
      <MigrationImport />
      <SiteFooter />
    </>
  );
}
