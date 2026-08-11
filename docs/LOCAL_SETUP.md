# 로컬 개발 환경 준비

이 문서는 Windows의 Codex 환경에서 모현제일교회 홈페이지를 안전하게 내려받고 검증하는 절차를 정리한다. 운영 사이트는 `https://mhji.kr`, 운영 브랜치는 `agent/netlify-deployment`, 원격 저장소는 `https://github.com/mhji-church/mohyeon-jeil-church-website.git`이다. 이 문서의 명령은 커밋·푸시·배포를 수행하지 않는다.

## 1. 저장소 복제와 운영 브랜치 확인

새 폴더에 처음 복제할 때:

```powershell
Set-Location 'C:\Users\ultra\Documents'
git clone 'https://github.com/mhji-church/mohyeon-jeil-church-website.git' 'mohyeon-jeil-church-website'
Set-Location '.\mohyeon-jeil-church-website'
git fetch --all --tags
git switch --track 'origin/agent/netlify-deployment'
git status --short --branch
git remote -v
git rev-parse HEAD
```

이미 로컬 브랜치가 있다면 사용자 변경이 없는 깨끗한 작업 트리에서만 다음을 실행한다.

```powershell
git status --short --branch
git fetch --all --tags
git switch 'agent/netlify-deployment'
git pull --ff-only
```

`reset --hard`, 강제 체크아웃, 강제 푸시는 사용하지 않는다. 2026-08-11에 확인한 운영 기준 커밋은 `07863a73570cde2b76b814913a7becc82aa9fdff`이다. 이 값은 최소 기준이며, 원격 운영 브랜치에 더 최신 커밋이 있으면 최신 커밋을 사용한다.

## 2. Node와 패키지 관리자

- `package.json`: Node `>=22.13.0`
- `netlify.toml`: 운영 빌드 Node `22.13.0`
- 패키지 관리자: npm
- 잠금 파일: `package-lock.json`
- 이 환경에서 확인한 조합: Node `v24.19.0`, npm `11.17.0`

의존성 버전을 임의로 올리거나 잠금 파일을 다시 만들지 않는다. 설치는 다음처럼 수행한다.

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
npm ci
```

설치 후 `git status --short`로 추적 파일이 바뀌지 않았는지 확인한다. `node_modules/`와 설치용 `.sites-runtime/`은 `.gitignore`로 보호된다.

## 3. 환경변수 준비

루트의 `.env.example`에는 변수 이름만 있고 실제 값은 없다. 로컬 전용 파일을 만들 때:

```powershell
Copy-Item -LiteralPath '.env.example' -Destination '.env.local'
```

실제 값은 암호 관리자나 승인된 운영 설정에서 받아 `.env.local` 또는 현재 PowerShell 세션에만 넣는다. `.env.local`을 커밋하거나 터미널에 값을 출력하지 않는다.

| 변수 | 용도 | 운영 필요성 |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | Turso/libSQL 접속 주소 | 게시물·회원·사업장·YouTube 캐시 사용에 필수 |
| `TURSO_AUTH_TOKEN` | Turso 인증 | 위 데이터 기능에 필수 |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 S3 호환 접근 키 ID | 이미지 업로드·외부 이미지 조회에 필요 |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 비밀 접근 키 | 이미지 기능에 필요 |
| `R2_ENDPOINT` | R2 S3 호환 엔드포인트 | 이미지 기능에 필요 |
| `R2_BUCKET_NAME` | R2 버킷 이름 | 이미지 기능에 필요 |
| `ADMIN_USERNAME` | 관리자 로그인 아이디 | 운영에서 명시 권장 |
| `ADMIN_PASSWORD` | 관리자 로그인 비밀번호 | 운영 관리자 로그인에 필수 |
| `ADMIN_SESSION_SECRET` | 관리자 세션 서명 | 운영 관리자 로그인에 필수 |
| `MEMBER_SESSION_SECRET` | 교인 세션 서명 | 교인 로그인·보호 콘텐츠에 필수 |
| `YOUTUBE_API_KEY` | YouTube Data API 호출 | 재생목록 동기화에 필요 |
| `NEXT_PUBLIC_KAKAO_MAP_JAVASCRIPT_KEY` | 카카오맵 JavaScript SDK 공개 키 | 대화형 교회 위치 지도에 필요 |

Netlify에는 기존 `docs/NETLIFY-ENV.example`을 기준으로 같은 이름을 등록한다. `.openai/hosting.json`의 `DB`·`BUCKET` 선언은 Sites 호환 설정이며 현재 Netlify 운영의 Turso·외부 R2 설정을 대체하지 않는다.

## 4. 로컬 개발 서버

`package.json`의 `dev` 스크립트는 POSIX 형식의 환경변수 대입을 사용하므로 Windows PowerShell에서는 아래처럼 같은 내용을 직접 실행한다.

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
$env:WRANGLER_LOG_PATH = '.wrangler/wrangler.log'
npm exec -- vite
```

현재 프로젝트의 기본 접속 주소는 `http://localhost:3000/`이다. 포트가 사용 중이면 Vite가 출력한 실제 주소를 사용한다. 환경변수 없이도 정적 화면과 번들 폴백 콘텐츠는 확인할 수 있지만, Turso·R2·관리자·교인·실시간 YouTube 기능은 완전하게 검증할 수 없다. 확인이 끝나면 `Ctrl+C`로 서버를 종료하고 백그라운드에 남기지 않는다.

WSL이나 Git Bash처럼 POSIX 셸을 사용하는 환경에서는 기존 `npm run dev`를 사용할 수 있다.

## 5. 빌드·테스트·lint

Netlify 운영 프리셋 빌드:

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
$env:NITRO_PRESET = 'netlify'
npm run build
```

자동 테스트의 Windows 실행 방식:

```powershell
node --test tests/pwa-install.test.mjs tests/rendered-html.test.mjs
```

`npm test`는 POSIX 인라인 환경변수 구문을 사용하므로 네이티브 PowerShell에서는 위 두 단계로 나누어 실행한다.

`npm run lint`는 `bash scripts/sites-env.sh`를 호출한다. Bash가 없는 Windows에서는 실제 소스만 다음처럼 검사한다.

```powershell
npm exec -- eslint app lib db netlify tests drizzle.config.ts eslint.config.mjs next.config.ts postcss.config.mjs vite.config.ts
```

빌드 뒤 프로젝트의 원래 lint 명령을 실행하면 `.output/` 생성 코드가 검사 대상에 포함되어 실패한다. 현재 확인 결과 실제 소스 전용 lint는 오류 0개, `<img>` 사용 관련 경고 23개다. 테스트 통과를 위해 소스나 lint 설정을 임의로 바꾸지 않는다.

## 6. 자주 발생하는 Windows 오류

- `node` 또는 `npm`을 찾지 못함: Node 설치 폴더를 현재 세션의 `Path` 앞에 추가한다. 시스템 전역 PATH는 이 작업을 위해 임의 변경하지 않는다.
- `vite is not recognized`: `npm ci`가 끝까지 성공했는지 확인한다. 설치 프로세스가 남아 있으면 종료될 때까지 기다린 뒤 다시 실행한다.
- npm 설치 중 하위 스크립트가 `node`를 찾지 못함: `npm ci` 전에 위의 세션 전용 `Path` 설정을 적용한다.
- `bash`를 찾지 못함: 네이티브 Windows에서는 이 문서의 직접 실행 명령을 사용하거나 승인된 WSL/Git Bash를 사용한다.
- `Turso database environment is unavailable` 또는 환경변수 누락 오류: 가짜 값을 넣지 말고 필요한 변수의 승인된 실제 값을 준비한다.
- `EPERM`으로 `node_modules` 정리가 실패함: 실행 중인 dev/build 프로세스를 종료하고 다시 `npm ci`를 실행한다. 사용자 소스 파일을 삭제하지 않는다.
- 경로에 한글이나 공백이 있음: PowerShell 경로를 항상 작은따옴표로 감싼다.
- Git의 dubious ownership 경고: Codex 샌드박스에서만 발생할 수 있다. 전역 설정 대신 명령별 `git -c safe.directory='C:/Users/ultra/Documents/mohyeon-jeil-church-website' ...`를 사용한다.

## 7. 작업 시작·종료 점검

작업 시작 전:

```powershell
git status --short --branch
git rev-parse HEAD
git rev-list --left-right --count HEAD...origin/agent/netlify-deployment
```

작업 종료 전에는 운영 프리셋 빌드, 자동 테스트, 실제 소스 lint, 변경 파일 diff를 확인한다. 커밋·푸시·PR·Netlify 배포는 사용자가 명시적으로 승인했을 때만 수행한다.
