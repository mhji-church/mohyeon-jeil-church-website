# Netlify 배포 설정

이 브랜치는 Vinext + Nitro의 Netlify 프리셋을 사용한다. Netlify에서 배포 브랜치는
`agent/netlify-deployment`, 빌드 명령은 `npm run build`, 게시 디렉터리는 `dist`로 지정한다.

배포 전에 `docs/NETLIFY-ENV.example`에 적힌 10개 환경변수를 Netlify에 등록한다. 실제 값은
GitHub에 커밋하지 않는다. 회원·게시물·사업장 신청 데이터는 Turso/libSQL에 저장되고,
주보·갤러리·성도사업장 이미지는 Cloudflare R2의 S3 호환 API에 저장된다.

처음 데이터베이스 요청이 발생하면 필요한 테이블과 인덱스를 자동 생성한다. 기존
Cloudflare D1의 운영 데이터는 자동으로 이동하지 않으므로 실제 전환 전 별도 이전이 필요하다.
