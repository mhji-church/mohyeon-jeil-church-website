# Netlify 배포 설정

이 브랜치는 Vinext + Nitro의 Netlify 프리셋을 사용한다. Netlify에서 배포 브랜치는
`agent/netlify-deployment`, 빌드 명령은 `npm run build:netlify`, 게시 디렉터리는 `dist`로 지정한다.

유튜브 재생목록은 Netlify Scheduled Functions로 자동 동기화한다. 예약 시각은 한국시간
기준 설교영상 매주 월요일 오전 8시 10분, 주일예배 매주 주일 오후 12시 35분이다.
동기화 결과는 Turso의 `youtube_playlist_cache` 테이블에 저장되며, 최초 요청 때 캐시가
비어 있으면 기존 영상 전체를 한 번 가져와 초기화한다.

배포 전에 `docs/NETLIFY-ENV.example`에 적힌 10개 환경변수를 Netlify에 등록한다. 실제 값은
GitHub에 커밋하지 않는다. 회원·게시물·사업장 신청 데이터는 Turso/libSQL에 저장되고,
주보·갤러리·성도사업장 이미지는 Cloudflare R2의 S3 호환 API에 저장된다.

DB 스키마는 요청 중 생성하지 않는다. `migrations/netlify/`의 순차 SQL을 프로덕션
배포 빌드 전에 적용하며 파일명과 체크섬을 `schema_migrations`에 기록한다. 이 단계가
실패하면 애플리케이션 빌드도 실패한다. 로컬·Deploy Preview·운영 브랜치가 아닌 빌드는
운영 DB에 접근하지 않고 마이그레이션을 건너뛴다. 기존 데이터를 삭제하거나 덮어쓰는
마이그레이션은 허용하지 않는다. 롤백은 적용한 SQL을 수정하지 않고 애플리케이션 커밋을
되돌린 뒤, 필요한 보정은 새 추가형 마이그레이션으로 임시 DB에서 먼저 검증한다.

## 회원 계정 병합 스키마 롤백

`0002_member_account_merges.sql`은 기존 `members`, `member_app_access`,
`business_applications`를 변경하지 않고 병합 관계·로그인 별칭·세션 버전 테이블과
인덱스만 추가한다. 따라서 애플리케이션 커밋을 되돌려도 기존 코드는 추가 테이블을
무시하고 동작한다. 이미 실행된 병합은 원본 회원 행, 원본 권한, 관련 기록 연결 및
병합 당시 스냅샷을 보존하므로 테이블 삭제로 되돌리지 않는다. 잘못된 병합의 복구는
운영 백업과 병합·감사 기록을 대조한 뒤 별도의 검증된 추가형 보정 마이그레이션으로만
수행한다.
