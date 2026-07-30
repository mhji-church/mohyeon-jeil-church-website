import type { Metadata } from "next";
import ContentPage from "../../components/ContentPage";
import { requireMemberPage } from "../../member-auth";
import BusinessApplicationForm from "./BusinessApplicationForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "사업장 등록 신청 | 모현제일교회",
  description: "모현제일교회 성도사업장 등록 신청 페이지입니다.",
};

export default async function BusinessApplicationPage() {
  const member = await requireMemberPage("/business/apply");

  return (
    <ContentPage
      eyebrow="BUSINESS APPLICATION"
      title="사업장 등록 신청"
      description="성도님이 운영하는 사업장 정보를 보내주시면 확인 후 성도사업장에 등록합니다."
      current="성도사업장"
      heroImage="/assets/hero-flowers.webp"
    >
      <BusinessApplicationForm
        applicantName={member.name}
        applicantPhone={member.phone}
      />
    </ContentPage>
  );
}
