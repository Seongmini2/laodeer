/*
  작업 기록
  ─────────
  새 기록은 이 목록 아무 곳에나 추가하면 됩니다. 화면에서는 날짜순(최신이 위)으로 자동 정렬돼요.

  꼭 필요한 것 세 가지
    date : "2026-11-27"            날짜
    type : "개발일지" | "생각" | "그림"
    body : "본문"                   빈 줄로 문단을 나누고, "- "로 시작하는 줄은 목록이 됩니다.
                                    개발일지의 목록은 "바꾼 점"으로 표시돼요.

  있으면 쓰는 것
    title : "제목"                  생각 글에 제목이 있으면 홈에서는 제목과 첫 문장만 보여줘요.
                                    제목이 없는 짧은 기록은 홈에서 전부 보여줍니다.
    image : "images/파일.png"       그림·스크린샷. 원본 비율 그대로 표시돼요.
    alt   : "이미지 설명"           생략하면 본문 첫 줄을 씁니다.
    game  : "soul"                  data/games.js 의 id. 적으면 게임 페이지에 모이고, 기록에서 게임으로 넘어갈 수 있어요.
    id    : "my-essay"              다른 곳에서 이 글을 가리킬 때 쓰는 이름 (소개 페이지의 글 연결 등)

  example: true 는 시안용 예시 표시입니다. 실제 기록에는 빼주세요.

  가장 짧은 예:
    { date: "2026-11-27", type: "생각", body: "오늘은 색을 하나 덜어냈다." },
*/
window.LAODEER_RECORDS = [
  {
    "date": "2026-11-24",
    "type": "그림",
    "body": "그림 캡션 예시. 한두 줄 정도의 짧은 설명이 이 자리에 들어갑니다.",
    "image": "assets/examples/drawing-portrait.svg",
    "game": "soul",
    "example": true
  },
  {
    "date": "2026-11-18",
    "type": "생각",
    "body": "제목 없이 짧게 남긴 생각의 예시입니다. 이런 기록은 홈에서 끝까지 다 읽을 수 있어요.",
    "example": true
  },
  {
    "date": "2026-11-18",
    "type": "개발일지",
    "title": "Sleeve It! v1.2.0 — Collect Cards, Build Combos, Aim for Perfect!",
    "body": "제목 없이 짧게 남긴 개발일지 예시.\n\n- 바꾼 점 한 줄 예시",
    "image": "images/2026/2026-11-18-zcum.png",
    "game": "itch-io"
  },
  {
    "date": "2026-11-16",
    "type": "개발일지",
    "title": "Sleeve It! Update — Online Leaderboards Are Here!",
    "body": "새로운 소식\n\n- **개인 최고 수익 추적:** 최고 수익 기록은 기기에 로컬로 저장됩니다.\n\n- **온라인 순위표:** 점수를 제출하고 다른 플레이어들과 비교해 보세요!\n\n- **전체 화면 버튼:** 플레이어의 요청에 따라 추가되었습니다.",
    "image": "images/2026/2026-11-16-7w6l.png",
    "game": "itch-io",
    "example": true
  },
  {
    "date": "2026-11-12",
    "type": "그림",
    "body": "가로로 긴 그림의 캡션 예시.",
    "image": "assets/examples/drawing-landscape.svg",
    "example": true
  },
  {
    "id": "essay-example",
    "date": "2026-11-05",
    "type": "생각",
    "title": "생각 글 제목 예시",
    "body": "홈에서는 이 첫 문장까지만 보여줍니다. 그 뒤 문장부터는 '이어 읽기'를 눌렀을 때 펼쳐져요.\n\n두 번째 문단 예시입니다. 실제 글로 바꾸면 길이에 맞춰 자연스럽게 늘어나요.\n\n세 번째 문단 예시입니다.",
    "example": true
  },
  {
    "date": "2026-10-20",
    "type": "그림",
    "body": "정사각형 그림의 캡션 예시.",
    "image": "assets/examples/drawing-square.svg",
    "game": "soul",
    "example": true
  },
  {
    "date": "2026-10-14",
    "type": "개발일지",
    "title": "스크린샷이 있는 개발일지 예시",
    "body": "작업 메모 예시 문장입니다.\n\n- 바꾼 점 예시\n- 바꾼 점 예시",
    "image": "assets/examples/screenshot-2.svg",
    "game": "soul",
    "example": true
  },
  {
    "date": "2026-10-03",
    "type": "그림",
    "body": "세로로 긴 그림의 캡션 예시. 화면보다 긴 그림은 화면 높이에 맞춰 줄여서 보여줘요.",
    "image": "assets/examples/drawing-tall.svg",
    "example": true
  }
];
