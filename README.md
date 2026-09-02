# 모현제일교회 홈페이지

모현제일교회 공식 홈페이지와 교인·관리자·예배 아카이브 기능을 제공하는 Vinext/React 애플리케이션이다.

## 운영 기준

- 운영 도메인: `https://mhji.kr`
- 운영 호스팅: Netlify
- 운영 브랜치: `agent/netlify-deployment`
- 배포: 운영 브랜치에 승인된 커밋이 반영될 때 Netlify 자동 배포 1회만 실행
- 빌드: `npm run build:netlify`
- 데이터: Turso/libSQL, Cloudflare R2

운영 브랜치 푸시, 수동 배포, 미리보기 배포, 운영 데이터 변경은 각각 명시적인 승인을 받은 경우에만 수행한다.

## 로컬 개발

Node.js 22.13 이상이 필요하다. 비밀값은 저장소에 넣지 않고 `.env.local` 또는 실행 환경에만 둔다.

```sh
npm ci
npm run dev
```

주요 검사는 다음과 같다.

```sh
npm run typecheck
npm test
npm run db:migrate:validate
npm run build
npm run lint
```

## 데이터베이스 변경

요청 처리 중에는 DDL이나 초기 데이터를 실행하지 않는다. Netlify용 순차 마이그레이션은 `migrations/netlify/`에 추가하며, 적용 파일명과 체크섬은 `schema_migrations`에 기록된다. `build:netlify`는 Netlify 프로덕션 컨텍스트와 정확한 운영 브랜치에서만 마이그레이션을 먼저 적용하고, 실패하면 빌드를 중단한다. 로컬과 Deploy Preview에서는 운영 DB 마이그레이션을 건너뛴다.

초기 콘텐츠가 꼭 필요한 새 DB는 마이그레이션 후 `scripts/seed-content.mjs`를 별도로, 명시적 입력 파일과 허용 플래그로만 실행한다.

## 문서

- `docs/NETLIFY-DEPLOYMENT.md`: 배포와 마이그레이션
- `docs/BACKUP_RECOVERY.md`: Turso/R2 백업과 임시 복구 검증
- `docs/LOCAL_SETUP.md`: 로컬 환경
- `docs/MAINTENANCE_HANDOFF.md`: 유지보수 인계
