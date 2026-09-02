# Turso·Cloudflare R2 백업 및 복구

## 원칙

- 운영 비밀값과 백업 결과는 Git에 넣지 않는다. 출력 폴더는 반드시 명시하며 저장소 밖의 암호화된 위치를 권장한다.
- DB와 R2는 매일 백업하고 주 1회 별도 매체 복제를 권장한다. 일별 14개, 주별 8개, 월별 12개를 기본 보존안으로 삼되 실제 용량·비용을 확인한 뒤 승인하여 정한다.
- 복구 연습은 분기 1회 임시 DB와 이름에 `temp`/`restore`/`test`가 포함된 임시 버킷에서만 수행한다.
- 이 저장소는 예약 작업, 버킷 수명 주기, 외부 설정을 자동 활성화하지 않는다.

Turso는 시점 복구 기능을 제공하며, Cloudflare R2는 S3 호환 API와 객체 다운로드를 제공한다. R2의 높은 내구성은 실수로 삭제된 객체를 복구해 주는 백업과 같지 않다. 실행 전 [Turso 시점 복구](https://docs.turso.tech/features/point-in-time-recovery), [R2 S3 API](https://developers.cloudflare.com/r2/api/s3/), [R2 객체 다운로드](https://developers.cloudflare.com/r2/objects/download-objects/), [R2 내구성](https://developers.cloudflare.com/r2/reference/durability/)의 현재 기능과 비용을 다시 확인한다.

## Turso 논리 백업

읽기 전용 토큰을 권장한다. 아래 명령은 스키마와 행을 JSON으로 저장하고 SHA-256 파일을 함께 만든다. 값이나 토큰은 콘솔에 출력하지 않는다.

```sh
node scripts/backup-turso.mjs --output=D:/mhji-backups/turso
```

복구는 운영 URL을 받지 않으며 이름에 `temp`/`restore`가 포함된 명시적 로컬 SQLite 경로만 허용한다.

```sh
node scripts/restore-turso-temp.mjs --input=D:/mhji-backups/turso/file.backup.json --target=D:/mhji-restore-temp/test.sqlite --confirm-temporary-target
```

완료 후 스크립트의 `PRAGMA integrity_check`, 행 수와 주요 화면을 확인한다.

## R2 객체 백업

AWS CLI와 목록/읽기만 허용한 R2 자격 증명을 사용한다. S3 호환 `sync` 후 객체별 크기와 SHA-256을 `manifest.backup.json`에 기록한다.

```sh
node scripts/backup-r2.mjs --output=D:/mhji-backups/r2
```

복구 연습은 별도로 만든 임시 버킷과 쓰기 권한 자격 증명을 사용한다.

```sh
node scripts/restore-r2-temp.mjs --input=D:/mhji-backups/r2 --temporary-bucket=mhji-restore-test --confirm-temporary-target
```

임시 버킷의 객체 수·크기·무작위 파일 체크섬과 브라우저 표시를 확인한다. 삭제는 별도 승인한다. 예약 백업, 버전 관리, 수명 주기 정책은 비용과 보존 요구를 정한 뒤 별도 승인으로 설정한다.
