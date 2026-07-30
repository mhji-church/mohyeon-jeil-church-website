import { createBusinessApplication } from "../../../lib/business-applications";
import { getMemberSession } from "../../member-auth";

export async function POST(request: Request) {
  const member = await getMemberSession();
  if (!member) {
    return Response.json(
      { error: "교인 로그인 후 신청할 수 있습니다." },
      { status: 401 },
    );
  }
  const payload = (await request.json().catch(() => null)) as
    | {
        applicantName?: unknown;
        applicantPhone?: unknown;
        businessName?: unknown;
        category?: unknown;
        ownerName?: unknown;
        businessPhone?: unknown;
        address?: unknown;
        description?: unknown;
        website?: unknown;
        imageUrl?: unknown;
      }
    | null;
  if (!payload) {
    return Response.json({ error: "신청 내용을 확인해 주세요." }, { status: 400 });
  }
  try {
    const id = await createBusinessApplication(member.id, {
      applicantName:
        typeof payload.applicantName === "string"
          ? payload.applicantName
          : member.name,
      applicantPhone:
        typeof payload.applicantPhone === "string"
          ? payload.applicantPhone
          : member.phone,
      businessName:
        typeof payload.businessName === "string" ? payload.businessName : "",
      category: typeof payload.category === "string" ? payload.category : "",
      ownerName:
        typeof payload.ownerName === "string" ? payload.ownerName : member.name,
      businessPhone:
        typeof payload.businessPhone === "string" ? payload.businessPhone : "",
      address: typeof payload.address === "string" ? payload.address : "",
      description:
        typeof payload.description === "string" ? payload.description : "",
      website: typeof payload.website === "string" ? payload.website : "",
      imageUrl: typeof payload.imageUrl === "string" ? payload.imageUrl : "",
    });
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "사업장 등록 신청을 접수하지 못했습니다.",
      },
      { status: 400 },
    );
  }
}
