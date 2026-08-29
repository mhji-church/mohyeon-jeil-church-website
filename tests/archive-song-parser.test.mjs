import assert from "node:assert/strict";
import test from "node:test";
import { dedupeSongTitles, normalizeSongTitle, parseSongTitle, parseYouTubeDescription } from "../lib/archive-song-parser.ts";

test("YouTube 설명란에서 지정된 줄 시작 라벨만 파싱한다", () => {
  const result = parseYouTubeDescription(`예배 안내입니다.
찬양: 은혜 / 내 주 하나님 넓고 큰 은혜는(원제) // 하나님의 부르심
설교 제목 ： 모두가 세상의 무가치함과 싸우고 있다
설교본문: 다니엘 1장 7~9절
대표 기도 : 윤영현 집사
안내 찬양: 이 줄은 인식하지 않음`);
  assert.deepEqual(result, {
    songs: ["은혜", "내 주 하나님 넓고 큰 은혜는(원제)", "하나님의 부르심"],
    sermonTitle: "모두가 세상의 무가치함과 싸우고 있다",
    biblePassage: "다니엘 1장 7~9절",
    prayerName: "윤영현",
    prayerRole: "집사",
  });
});

test("빈 항목을 제거하고 같은 곡의 기본 제목과 별칭 표기를 중복 제거한다", () => {
  const songs = dedupeSongTitles(["은혜", " 은혜 ", "내 주 하나님 넓고 큰 은혜는(원제)", "원제"]);
  assert.equal(songs.length, 2);
  assert.equal(songs[0].displayTitle, "은혜");
  assert.equal(songs[1].baseTitle, "내 주 하나님 넓고 큰 은혜는");
  assert.deepEqual(songs[1].aliases, ["원제"]);
});

test("곡명 정규화는 유니코드·공백·괄호 주변 표기를 안정적으로 맞춘다", () => {
  assert.equal(normalizeSongTitle("  내   주 하나님 ( 원제 ) "), "내 주 하나님(원제)");
  assert.deepEqual(parseSongTitle("내 주 하나님 ( 원제 )"), {
    displayTitle: "내 주 하나님(원제)",
    baseTitle: "내 주 하나님",
    normalizedBaseTitle: "내 주 하나님",
    aliases: ["원제"],
    normalizedAliases: ["원제"],
  });
});

test("설명란에 일부 항목만 있거나 값이 비어 있어도 존재하는 값만 반환한다", () => {
  assert.deepEqual(parseYouTubeDescription("교회 안내\n설교 제목: 은혜로 사는 삶\n찬양:   \n대표 기도：김기도"), {
    sermonTitle: "은혜로 사는 삶",
    prayerName: "김기도",
  });
});
