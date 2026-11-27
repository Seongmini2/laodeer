/*
  스튜디오 정보 (첫 화면, ABOUT, SOCIALS, FAQ, PRESS KIT 에서 씀)
  관리 화면(admin.html)의 "스튜디오" 탭에서 고치는 걸 권해요.

  slogan      : 첫 화면 가운데 두 줄 (en 큰 글씨, ko 작은 글씨)
  heroImage   : 첫 화면 배경 장면. 흐리고 어둡게 깔려요.
  logo        : 로고 이미지. 비워두면 글자 로고(LA◐DEER)를 써요.
  statement   : ABOUT 맨 위 문장과 쓴 사람
  intro       : ABOUT 소개 문단들
  essay       : ABOUT에 연결할 "만드는 기준에 관한 글" (records.js 생각 글의 id)
  team        : 팀 (name, role, handle, photo)
  socials     : SOCIALS (label 플랫폼 이름, handle 계정, url 주소)
  faq         : FAQ (q 질문, a 답)
  pressContact: 프레스 킷 연락처

  example: true 는 시안용 예시 표시입니다.
*/
window.LAODEER_STUDIO = {
  "slogan": {
    "en": "Play should be pure. We just add soul.",
    "ko": "놀이는 순수해야 합니다 우리는 영혼을 더할 뿐입니다."
  },
  "heroImage": "images/2026/hero-rf3p.png",
  "logo": "images/2026/logo-vo65.png",
  "statement": {
    "text": "Small studio, not chasing noise. Makes games with feeling, not features. One step at a time, toward something real.",
    "by": "Jeon Seong min"
  },
  "intro": [
    "LaoDeer가 어떤 작업을 하는지 한두 문장으로 적는 자리입니다.",
    "필요하면 문단을 하나 더 쓸 수 있어요. 길게 쓰기보다 짧게 두는 걸 권해요."
  ],
  "essay": "essay-example",
  "team": [
    {
      "name": "Jeon Seong min",
      "role": "CEO, Game designer & Programmer",
      "handle": "@LaoDeer",
      "photo": "images/2026/team-swpg.png"
    }
  ],
  "socials": [
    {
      "label": "X ( 구 트위터 )",
      "handle": "@LaoDeer_",
      "url": "https://x.com/LaoDeer_"
    },
    {
      "label": "YOUTUBE",
      "handle": "@LaoDeer",
      "url": "https://www.youtube.com/@LaoDeer"
    },
    {
      "label": "DISCORD",
      "handle": "@lian_619"
    }
  ],
  "faq": [
    {
      "q": "자주 받는 질문 예시",
      "a": "답변이 들어갈 자리입니다. 관리 화면의 스튜디오 탭에서 질문과 답을 추가하거나 지울 수 있어요.",
      "example": true
    },
    {
      "q": "두 번째 질문 예시",
      "a": "누르면 답이 펼쳐지고, 다시 누르면 접혀요.",
      "example": true
    }
  ],
  "pressContact": "@LaoDeer"
};
