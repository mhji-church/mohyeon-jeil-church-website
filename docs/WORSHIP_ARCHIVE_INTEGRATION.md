# 예배 아카이브 통합 운영 안내

## 구성

- 교회 홈페이지 회원 계정과 `mhji_member_session` 쿠키를 그대로 사용합니다.
- 아카이브 경로는 `/archive`, 독립 관리자 경로는 `/archive/admin`입니다.
- 영상 파일은 서버에 업로드하지 않습니다. 관리자가 YouTube 일부 공개 URL을 등록하는 기존 방식을 유지합니다.
- 공개 목록 API는 날짜, 제목, 예배 종류, 설교자 등 메타데이터만 반환합니다.
- YouTube ID와 재생 주소는 승인된 회원의 등급을 서버에서 확인한 뒤 재생 API가 반환합니다.

## 열람 등급

| 등급 | 예배 실황 | 출석 기록 |
| --- | --- | --- |
| `none` | 불가 | 불가 |
| `worship` | 가능 | 불가 |
| `full` | 가능 | 가능 |

회원 가입과 승인은 홈페이지의 기존 회원 관리 절차를 사용합니다. 승인 후에도 아카이브 관리자가 `/archive/admin`의 `열람 등급`에서 별도로 등급을 부여해야 합니다. 홈페이지 관리자와 아카이브 관리자는 서로 다른 계정과 세션을 사용합니다.

## 데이터 이전

기존 로컬 아카이브에서 다음 명령으로 활성 영상만 내보냅니다. 이 파일에는 일부 공개 URL이 있으므로 Git에 커밋하지 않습니다.

```powershell
node scripts/export-homepage-archive-videos.mjs data/mohyeon-archive.sqlite C:\private\archive-videos.seed.json
```

홈페이지 저장소에서 먼저 검증하고, Netlify와 동일한 Turso 환경변수로 가져옵니다.

```powershell
node scripts/import-archive-videos.mjs C:\private\archive-videos.seed.json --dry-run
node scripts/import-archive-videos.mjs C:\private\archive-videos.seed.json
```

가져오기는 같은 ID를 다시 실행해도 갱신되는 방식입니다. 회원, 비밀번호, 세션, 감사 로그는 이 도구가 읽거나 이전하지 않습니다.

## Netlify 환경변수

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `MEMBER_SESSION_SECRET`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`
- `ARCHIVE_ADMIN_USERNAME`
- `ARCHIVE_ADMIN_PASSWORD`
- `ARCHIVE_ADMIN_SESSION_SECRET`
- `YOUTUBE_API_KEY`

실제 값은 Netlify 환경변수에만 저장하고 저장소에는 커밋하지 않습니다.

## 보안 한계

사이트는 비회원에게 YouTube ID와 URL을 응답하지 않지만, 승인 회원이 재생 후 일부 공개 주소를 외부에 공유하는 것까지 막는 DRM은 아닙니다. 더 강한 통제가 필요하면 향후 만료형 서명 URL을 제공하는 인증형 동영상 호스팅을 사용해야 합니다.
