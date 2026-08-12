# 사업장 등록 신청 기능 백업

사업장 등록 신청 기능은 목회자 요청에 따라 공개 화면과 API에서 비활성화했다.

## 원본 복원 지점

- Git 커밋: `1873a11f26cc3e012add394bcd30f25612b6cbe7`
- 커밋 제목: `모바일 최적화와 카카오맵·관리 화면 개선`

이 커밋에는 다음 항목이 모두 정상 작동하던 상태로 보존되어 있다.

- 교인 전용 `/business/apply` 신청 페이지
- 신청 폼 전체 UI와 모바일 디자인
- 사업장 이미지 업로드 및 신청 제출 API
- 관리자 신청 목록·검토·게시·삭제 화면과 API
- 성도사업장 페이지의 PC·모바일 신청 버튼

## 프로젝트 안에 남긴 비활성 백업

- `app/business/apply/BusinessApplicationForm.tsx`: 신청 폼 컴포넌트
- `app/admin/business-applications/AdminBusinessApplications.tsx`: 관리자 신청 관리 화면
- `lib/business-applications.ts`: 신청 저장·조회·게시 로직
- `app/globals.css`의 `Business application` 관련 스타일
- `business_applications` 데이터베이스 테이블과 기존 데이터

공개 페이지와 API 진입 파일만 제거했으므로 위 코드는 현재 실행되지 않는다. 기능을 다시 사용할 때는 원본 커밋에서 삭제된 `page.tsx`와 API `route.ts`를 복원하고, 성도사업장 페이지 및 관리자 메뉴의 진입 링크를 다시 연결한다.
