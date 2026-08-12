# 모현제일교회 홈페이지 유지보수 인계서

## 운영 기준

- 운영 URL: `https://mhji.kr`
- GitHub: `https://github.com/mhji-church/mohyeon-jeil-church-website.git`
- 운영 브랜치: `agent/netlify-deployment`
- 2026-08-11 확인 운영 HEAD: `07863a73570cde2b76b814913a7becc82aa9fdff`
- 배포: Netlify가 운영 브랜치 변경을 감지해 자동 배포
- 빌드: `NITRO_PRESET=netlify npm run build`
- 게시 디렉터리: `dist`

`.openai/hosting.json`은 저장소에 남아 있는 Sites 호환 설정이다. 현재 실제 운영은 Netlify와 `mhji.kr`이며, 별도 승인 없이 호스팅 서비스를 바꾸지 않는다.

## 기술 스택과 애플리케이션 진입점

- Vinext `0.0.50`, Vite `8`, Next.js App Router 호환 구조
- React `19`, TypeScript `5.9`, Tailwind CSS `4`
- Nitro `3` Netlify 프리셋
- Turso/libSQL + `@libsql/client`, Drizzle 스키마·마이그레이션
- Cloudflare R2 S3 호환 API를 서버에서 직접 서명해 사용
- YouTube Data API + Netlify Scheduled Functions
- PWA manifest, 아이콘, 서비스워커

주요 진입점은 `app/layout.tsx`, `app/page.tsx`, `vite.config.ts`, `netlify.toml`이다. 전역 레이아웃은 `app/components/SiteLayoutChrome.tsx`에서 공통 헤더·푸터를 붙이며 `/admin` 경로에는 이를 붙이지 않는다.

## 디렉터리와 파일 역할

| 경로 | 역할 |
| --- | --- |
| `app/` | 페이지, UI 컴포넌트, Route Handler API, 인증 보조 코드 |
| `app/page.tsx` | 메인 4K 히어로, 설교·소식 요약, PWA 설치 UI |
| `app/components/` | 공통 헤더·푸터, 콘텐츠 레이아웃, 영상 목록, 확대 이미지 |
| `app/admin/` | 관리자 로그인 이후 게시물·회원 관리 UI |
| `app/api/` | 공개·교인·관리자 API와 미디어 프록시 |
| `lib/` | 콘텐츠, 회원, 사업장, Turso, R2, YouTube 도메인 로직 |
| `db/` | Drizzle용 테이블 정의와 libSQL 클라이언트 |
| `drizzle/` | 버전 관리되는 SQLite 마이그레이션 |
| `netlify/functions/` | YouTube 재생목록 예약 동기화 함수 |
| `public/` | 정적 이미지, PWA 아이콘·manifest·서비스워커 |
| `tests/` | PWA·공통 레이아웃·렌더링 회귀 테스트 |
| `docs/NETLIFY-DEPLOYMENT.md` | 기존 Netlify 배포 요약 |
| `docs/NETLIFY-ENV.example` | 기존 Netlify 환경변수 예시 |

## 페이지별 핵심 기능

- `/`: 5장의 4K 히어로 이미지, 슬라이드별 데스크톱·모바일 초점 위치, 빠른 메뉴, 최신 설교 3개, 교회소식 3개, 예배시간, PWA 설치 안내를 제공한다.
- `/about`: 교회 소개 콘텐츠.
- `/worship`: YouTube 주일 2부 예배 재생목록. 제목에 `주일 2부 예배`가 포함된 영상만 표시한다.
- `/sermons`: 설교 재생목록. 페이지당 8개, 모달 재생, 페이지 이동 후 목록 영역이 보이도록 스크롤 위치를 조정한다.
- `/bulletin`: 최신 주보와 지난 주보. 좌우 페이지 이동, 키보드, 모바일 스와이프·핀치 확대를 제공한다.
- `/news`: 날짜 쿼리와 `#news-YYYY-MM-DD` 앵커로 해당 소식을 펼치고 브라우저 앵커 이동을 사용한다.
- `/gallery`: 목록·표지 이미지는 공개하지만 상세 앨범과 표지 이후 이미지는 승인된 교인 또는 관리자에게만 제공한다. 앨범 모달, 직접 링크 쿼리, 키보드·스와이프·썸네일 이동을 제공한다.
- `/business`: 공개된 성도사업장 목록과 선택적 외부 웹사이트 링크.
- `/member/signup`, `/member/login`, `/member`, `/member/password`: 가입 신청, 승인 계정 로그인, 개인 정보·비밀번호 관리, 임시 비밀번호 강제 변경.
- `/admin`, `/admin/members`: 게시물 CRUD, 공개/임시저장, 이미지 업로드, 회원 승인·수정·이용 중지·비밀번호 초기화·삭제.

## 인증과 권한

관리자 인증은 `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`과 HMAC 서명 HttpOnly 쿠키 `mhji_admin_session`을 사용한다. 운영에서는 개발용 기본값이 적용되지 않으므로 비밀번호와 세션 비밀값이 반드시 필요하다.

교인 비밀번호는 PBKDF2-SHA256 100,000회와 개별 salt로 저장한다. 가입 직후 상태는 `pending`, 관리자가 `approved`로 바꿔야 로그인할 수 있으며 `suspended` 계정은 거부된다. 교인 세션은 `MEMBER_SESSION_SECRET`으로 서명한 HttpOnly 쿠키 `mhji_member_session`을 사용한다. 로그인한 헤더에는 이름과 직분을 표시하고 내 정보·로그아웃 메뉴를 제공한다.

직접 보호 경로인 `/gallery/[id]`, `/member`는 `return_to`를 사용해 로그인 후 복귀한다. 현재 `app/gallery/GalleryBoard.tsx`의 비로그인 앨범 링크만 `returnTo`를 사용하지만 로그인 페이지는 `return_to`만 읽는다. 따라서 갤러리 목록에서 로그인한 경우 원래 앨범으로 복귀하지 못할 가능성이 있으며, 다음 기능 수정 때 영향 분석과 회귀 테스트를 거쳐 확인해야 한다.

## 데이터와 외부 연동

### Turso/libSQL

`lib/netlify-db.ts`가 `TURSO_DATABASE_URL`과 `TURSO_AUTH_TOKEN`으로 접속한다. 최초 요청 시 다음 테이블을 `CREATE TABLE IF NOT EXISTS`로 보장한다.

- `content_posts`: 주보·교회소식·갤러리·성도사업장
- `members`: 교인 계정과 승인 상태
- `business_applications`: 비활성화된 성도사업장 신청의 기존 데이터 보존용 테이블
- `youtube_playlist_cache`: YouTube 동기화 캐시

`db/schema.ts`와 `drizzle/`도 유지된다. 스키마를 바꿀 때 런타임 보장 SQL, Drizzle 스키마, 마이그레이션의 일관성을 함께 검토한다. 기존 D1 데이터는 Turso로 자동 이전되지 않는다.

사업장 등록 신청 기능은 현재 공개 페이지·API·관리자 진입점에서 제거되어 있다. 폼과 디자인을 다시 사용할 때는 `docs/BUSINESS_APPLICATION_BACKUP.md`의 복원 지점을 따른다.

### Cloudflare R2

`lib/external-r2.ts`가 R2 S3 호환 요청을 AWS Signature V4로 서명한다. 업로드는 관리자 또는 로그인 교인 API를 통해서만 수행한다. `lib/content.ts`와 미디어 API는 다음 권한을 유지한다.

- 공개 게시물의 갤러리 표지, 주보·사업장 이미지는 공개 캐시 가능
- 갤러리의 표지 이후 상세 이미지는 교인 또는 관리자만 조회
- 임시저장 또는 참조되지 않은 객체는 비로그인 사용자에게 노출하지 않음
- 게시물·신청 삭제 시 연결된 외부 객체 삭제 로직이 있으므로 운영 데이터에서 직접 시험하지 않음

### YouTube

두 재생목록 ID는 `lib/youtube.ts`에 고정되어 있다. API 결과는 Turso 캐시에 저장되고, 캐시가 없으면 요청 시 동기화한다. Netlify 예약 함수는 설교를 월요일 08:10 KST, 주일 2부 예배를 일요일 12:35 KST에 갱신한다.

제목 처리 규칙:

- 설교 제목은 첫 번째 `|` 앞부분을 표시 제목으로 사용한다.
- `|` 뒤 두 부분이 모두 있으면 `성경 본문 · 설교자` 형태의 상세 문구로 합친다.
- 설교 날짜는 제목 끝의 `(YYYY년 M월 D일)`을 우선 사용하고, 없거나 유효하지 않으면 YouTube 게시일의 한국 날짜를 사용한다.
- 주일예배 목록은 원제에 `주일 2부 예배`가 포함된 영상만 유지한다.
- 캐시에는 `sourceTitle`을 보존해 이후 규칙 적용 시 원래 제목을 잃지 않는다.
- API 장애 시 화면은 코드에 번들된 기존 목록을 유지한다.

## PWA와 화면 회귀 기준

`public/manifest.webmanifest`의 이름·짧은 이름·id·standalone 표시, `public/sw.js`, 192/512/maskable 아이콘을 함께 유지한다. 메인 화면은 서비스워커를 등록하고 Android Chrome 설치 프롬프트와 iOS 안내를 분리한다.

메인 히어로는 4K 자산과 슬라이드별 `mobilePosition`을 사용한다. 이미지 교체 시 데스크톱과 720px 이하 모바일에서 인물·교회 건물 등 주요 피사체의 초점을 각각 확인한다.

## 환경변수 이름

실제 값은 이 문서에 기록하지 않는다. 필요한 이름은 다음과 같다.

`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET_NAME`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `MEMBER_SESSION_SECRET`, `YOUTUBE_API_KEY`, `NEXT_PUBLIC_KAKAO_MAP_JAVASCRIPT_KEY`.

## 수정 금지·주의 영역

- 사용자 승인 없이 운영 브랜치에 커밋·푸시하거나 Netlify 배포를 유발하지 않는다.
- `.openai/hosting.json`이 있어도 운영 호스팅을 Sites나 다른 서비스로 전환하지 않는다.
- 운영 `.env`, Turso 토큰, R2 키, YouTube 키, 관리자 비밀번호, 회원 개인정보를 출력·문서화·커밋하지 않는다.
- 운영 Turso 레코드나 R2 객체를 준비·테스트 목적으로 수정·삭제하지 않는다.
- 인증 쿠키 이름, 서명, 상태 판정, 갤러리 권한, 미디어 캐시 정책을 단순 UI 변경과 함께 건드리지 않는다.
- YouTube 원제와 `sourceTitle`, 제목·날짜 파싱 규칙을 훼손하지 않는다.
- `package-lock.json`을 임의 재생성하거나 주요 패키지를 자동 업그레이드하지 않는다.
- 공개 페이지에 이미 표시 중인 교회 연락처·헌금계좌 등 운영 정보는 그대로 보존하되 다른 문서로 불필요하게 복제하지 않는다.

## 기능별 회귀검사

| 변경 영역 | 최소 확인 |
| --- | --- |
| 공통 레이아웃 | 일반 페이지에 헤더·푸터 각 1개, 관리자 페이지에는 없음, 모바일 메뉴 |
| 메인 | 5개 히어로, 4K/모바일 초점, 설교·소식 폴백, PWA 설치 버튼 |
| 주보 | 최신·목록, 양면 이동, 확대, 키보드·모바일 스와이프 |
| 교회소식 | 날짜 쿼리로 올바른 항목 펼침, 앵커 이동 |
| 갤러리 | 비로그인 목록·표지만 공개, 로그인 복귀, 상세 미디어 401/404 정책, 모달 직접 링크 |
| 회원 | 가입→대기→승인→로그인, 이용 중지, 임시 비밀번호 강제 변경, 프로필 메뉴 |
| 관리자 | 인증 거부/허용, 콘텐츠 CRUD, 공개/임시저장, 이미지 업로드·삭제 |
| 사업장 | 교인 전용 신청, URL 정규화, 관리자 검토·게시, 외부 링크 조건부 표시 |
| YouTube | 두 재생목록, 첫 `|`, 상세 조합, 제목 괄호 날짜, 주일 2부 필터, 폴백 |
| PWA | manifest 이름·아이콘, 설치 UI, 서비스워커 등록 |

## 배포 전후 점검표

배포 전:

1. `git status`에 의도한 파일만 있는지 확인한다.
2. 운영 브랜치와 원격 차이를 확인하고 사용자 작업을 보존한다.
3. 환경변수 이름은 확인하되 값을 출력하지 않는다.
4. `NITRO_PRESET=netlify` 빌드, 자동 테스트, 실제 소스 lint를 수행한다.
5. Turso/R2/YouTube가 필요한 변경은 승인된 비운영 검증 경로가 없으면 정적 검증까지만 수행한다.
6. 사용자가 커밋·푸시·배포를 명시적으로 승인했는지 확인한다.

배포 후 `mhji.kr`에서 메인, 공통 메뉴, 주보, 교회소식 날짜 이동, 갤러리 비로그인/로그인, 회원 메뉴, 관리자 로그인, YouTube 두 목록, PWA manifest와 주요 이미지 응답을 확인한다. 운영 데이터 생성·삭제가 필요한 시험은 별도 승인을 받는다.

## 장애와 롤백 원칙

1. 먼저 Netlify 배포 로그와 실패 커밋 범위를 확인한다.
2. 데이터 변경이 없는 코드 장애는 마지막 정상 커밋을 기준으로 되돌림 커밋을 준비한다. `reset --hard`나 강제 푸시는 사용하지 않는다.
3. `git revert` 실행, 커밋, 푸시, Netlify 이전 배포 복구는 각각 사용자 승인을 받은 뒤 수행한다.
4. 스키마 변경은 코드만 되돌려 호환성이 깨지지 않는지 먼저 확인한다. 파괴적 데이터 롤백은 백업·이전 계획 없이 수행하지 않는다.
5. R2 삭제나 회원·게시물 수정이 포함된 장애는 코드 롤백으로 데이터가 복원되지 않는다. 별도 백업과 감사 기록을 기준으로 복구한다.
6. 복구 후 변경 파일, 제외 대상, 검증 결과와 `mhji.kr` 확인 결과를 사용자에게 보고한다.

## 다음 유지보수 요청의 기본 절차

`docs/CODEX_MAINTENANCE_CONTEXT.md` → 이 문서 → `docs/LOCAL_SETUP.md` → 기존 Netlify 문서 → 실제 관련 코드 순서로 읽는다. 그 다음 Git 상태, 운영 브랜치, 영향 범위, 필요한 환경변수 유무를 확인하고 최소 변경만 수행한다.
