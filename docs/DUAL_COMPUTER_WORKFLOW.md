# 데스크톱과 노트북에서 이어서 작업하기

이 프로젝트의 두 컴퓨터 공용 작업 브랜치는 다음입니다.

```text
feature/desktop-laptop-workspace
```

코드는 GitHub로만 동기화합니다. 프로젝트 폴더 전체를 OneDrive, Dropbox 등의 동기화 폴더에 넣지 마세요. Git 내부 파일 충돌이나 로컬 SQLite 파일 손상의 원인이 됩니다.

## 노트북 최초 설정

1. Git for Windows와 Node.js 22 LTS 이상을 설치합니다.
2. PowerShell에서 아래 명령을 한 줄씩 실행합니다.

```powershell
cd $env:USERPROFILE\Documents
git clone https://github.com/mhji-church/mohyeon-jeil-church-website.git
cd mohyeon-jeil-church-website
git switch feature/desktop-laptop-workspace
npm install
```

3. 로컬 서버가 필요한 경우 현재 데스크톱의 `.env.local`을 안전한 개인 방법(USB 등)으로 한 번만 옮겨 노트북 프로젝트 폴더에 넣습니다. 이 파일은 GitHub·이메일·메신저에 올리지 않습니다.

## 컴퓨터를 바꾸기 전

작업을 끝낸 컴퓨터에서 다음을 실행합니다.

```powershell
git status
git add -A
git commit -m "작업 내용"
git push
```

`git status`에서 `.env.local` 또는 `data/archive-preview.sqlite`가 보이면 커밋하지 말고 중단합니다.

## 다른 컴퓨터에서 작업 시작

다른 컴퓨터의 프로젝트 폴더에서 다음을 실행합니다.

```powershell
git switch feature/desktop-laptop-workspace
git pull
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 중요한 규칙

- 두 컴퓨터에서 동시에 같은 브랜치를 수정하지 않습니다.
- 항상 작업 시작 전 `git pull`, 작업 종료 전 `git push`를 실행합니다.
- 운영 배포 브랜치 `agent/netlify-deployment`에는 직접 작업하지 않습니다.
- 운영 배포와 병합은 별도 승인 전까지 진행하지 않습니다.
