# Codex 유지보수 컨텍스트

이 문서는 이후 Codex 세션이 모현제일교회 홈페이지 작업을 시작할 때 가장 먼저 읽는 운영 안전 규칙이다.

## 읽기 순서

1. `docs/CODEX_MAINTENANCE_CONTEXT.md`
2. `docs/MAINTENANCE_HANDOFF.md`
3. `docs/LOCAL_SETUP.md`
4. `docs/NETLIFY-DEPLOYMENT.md`
5. `docs/NETLIFY-ENV.example`와 루트 `.env.example`의 변수 이름
6. 루트 또는 작업 대상 하위 경로의 `AGENTS.md`가 새로 생겼는지 검색
7. `package.json`, `package-lock.json`, `netlify.toml`
8. 요청과 직접 관련된 `app/`, `lib/`, `db/`, `netlify/`, `tests/` 파일

## 작업 기준

- GitHub 원격은 `https://github.com/mhji-church/mohyeon-jeil-church-website.git`이다.
- 실제 운영 브랜치는 `agent/netlify-deployment`이다.
- 운영 사이트는 Netlify의 `https://mhji.kr`이다.
- 2026-08-11 확인 운영 HEAD `07863a73570cde2b76b814913a7becc82aa9fdff`는 최소 기준이다. 원격 운영 브랜치가 더 최신이면 최신 커밋을 사용하며 과거 커밋으로 되돌리지 않는다.
- 실제 운영 호스팅은 Netlify이며 다른 호스팅 설정을 추가하지 않는다.

## 사용자 변경 보존

작업 전 `git status --short --branch`, 현재 HEAD, 원격 운영 브랜치와의 차이를 확인한다. 사용자 수정 파일은 덮어쓰거나 정리하지 않는다. 작업 트리가 깨끗할 때만 `git pull --ff-only`를 고려한다. 강제 체크아웃, `reset --hard`, 강제 푸시, 사용자 파일 삭제는 금지한다.

이번 저장소 준비 단계에서 만든 문서와 `.env.example`은 커밋하지 않은 로컬 초안으로 남겨야 한다. 사용자가 명시적으로 승인하기 전에는 커밋·푸시·PR·Netlify 배포를 수행하지 않는다.

## 기능 수정 전 분석

1. 요청이 영향을 주는 페이지, API, 도메인 로직, 데이터 테이블, 외부 저장소, 인증 경계를 찾는다.
2. 공개/교인/관리자 권한과 비로그인 폴백을 구분한다.
3. Turso 스키마·런타임 보장 SQL·Drizzle 마이그레이션의 동기화 필요성을 확인한다.
4. R2 객체 생성·조회·삭제와 공개/비공개 캐시 정책 영향을 확인한다.
5. YouTube 원제, `sourceTitle`, 첫 `|`, 상세 조합, 제목 괄호 날짜, 주일 2부 필터 영향을 확인한다.
6. 메인 4K 이미지와 모바일 초점, 목록 이동 후 스크롤, 갤러리 모달·직접 링크, PWA 설치 흐름을 회귀 범위에 포함한다.
7. 확인되지 않은 기능은 구현됐다고 단정하지 않고 `추가 확인 필요`로 표시한다.

## 필수 검증

변경 후 최소 검증은 다음과 같다.

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
$env:NITRO_PRESET = 'netlify'
npm run build
node --test tests/pwa-install.test.mjs tests/rendered-html.test.mjs
npm exec -- eslint app lib db netlify tests drizzle.config.ts eslint.config.mjs next.config.ts postcss.config.mjs vite.config.ts
```

`npm test`, `npm run dev`, `npm run lint`의 일부 스크립트는 POSIX 셸 문법이나 Bash를 전제로 하므로 Windows에서는 `docs/LOCAL_SETUP.md`의 동등 명령을 사용한다. 테스트를 통과시키기 위해 기능 소스나 테스트를 임의 변경하지 않는다.

UI 변경이면 데스크톱과 모바일, 키보드와 터치, 공개와 로그인 상태를 확인한다. 사용자가 브라우저 검증을 요청하지 않았거나 운영 인증정보가 없으면 빌드·정적 테스트까지만 수행하고 제한을 보고한다.

## 비밀정보와 운영 데이터

- `.env`, `.env.local`, Netlify 값, Turso 토큰, R2 키, YouTube 키, 관리자 비밀번호를 읽어 출력하거나 문서·Git에 복제하지 않는다.
- 환경변수는 이름·용도·필수 여부만 보고한다.
- 회원 개인정보, 게시물 운영 데이터, 사업장 신청, R2 업로드 파일을 준비 작업이나 일반 테스트 목적으로 내려받거나 수정·삭제하지 않는다.
- 인증된 백업이 필요하면 필요한 절차와 범위만 설명하고 별도 승인을 받는다.
- 공개 사이트에 이미 표시되는 연락처와 헌금계좌는 기능 보존 대상으로 취급하고 다른 문서에 반복 기재하지 않는다.

## 독립적이고 되돌릴 수 있는 변경

한 요청은 가능한 한 하나의 목적과 최소 파일 범위로 제한한다. UI, 인증, 데이터 스키마, 배포 설정을 한 번에 묶지 않는다. 각 단계가 독립적으로 빌드·검증되고 일반 `git revert`로 되돌릴 수 있도록 설계한다. 데이터 삭제나 비가역 마이그레이션은 사용자 승인과 백업 계획 없이 수행하지 않는다.

## 배포 권한

다음 작업은 사용자가 이번 요청에서 명시적으로 승인했을 때만 수행한다.

- `git commit`
- `git push`
- GitHub PR 생성·병합
- Netlify 배포·재배포·롤백
- 운영 Turso 마이그레이션 또는 데이터 변경
- 운영 R2 객체 생성·교체·삭제
- 운영 환경변수 변경

`finish`, `배포 준비`, `확인해줘` 같은 표현만으로 위 권한을 추정하지 않는다.

## 작업 종료 보고

다음을 간결하게 보고한다.

1. 시작·종료 브랜치와 HEAD
2. 운영 기준 커밋과의 관계
3. 변경 파일과 각 파일의 목적
4. 의도적으로 제외한 파일·기능·데이터
5. 빌드·테스트·lint·화면 검증 결과
6. 환경변수 누락 때문에 검증하지 못한 항목
7. 발견한 기존 문제와 이번에 수정했는지 여부
8. 현재 `git status`
9. 커밋·푸시·배포가 수행되지 않았다는 확인

## 현재 추가 확인 필요 항목

- `app/gallery/GalleryBoard.tsx`는 로그인 링크에 `returnTo`를 쓰지만 로그인 페이지는 `return_to`만 읽는다. 갤러리 목록에서 로그인 후 원래 앨범 복귀 흐름을 실제 인증 환경에서 확인하고 별도 수정 요청으로 다룬다.
- 프로젝트 기본 lint 명령은 빌드 산출물 `.output/`을 제외하지 않아 빌드 후 실패한다. 실제 소스 전용 lint는 별도 명령으로 통과(경고만)했으며, lint 설정 변경은 별도 승인 범위다.
- 운영 Turso·R2·YouTube·관리자·교인 기능은 실제 비밀값과 비운영 검증 환경 없이 쓰기 테스트하지 않는다.
- 운영 데이터 백업·복구 가능성은 저장소 코드만으로 확인되지 않는다. 운영 계정과 백업 정책 확인이 별도로 필요하다.
