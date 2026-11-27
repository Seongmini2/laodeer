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
    "en": "A game gains depth in the making."
  },
  "heroImage": "images/2026/hero-rf3p.png",
  "logo": "images/2026/logo-vo65.png",
  "statement": {
    "text": "세상이 빠르게 변할수록 저는 제가 만드는 게임에서 무엇을 지키고 싶은지 자주 생각합니다. 도구는 달라져도, 무엇을 만들고 왜 그렇게 만들지 고민하는 일에는 변함없는 가치가 있다고 믿습니다.  \n\n완성된 화면에는 끝내 버린 아이디어도, 몇 번이나 처음으로 돌아갔는지도 보이지 않습니다. 그래도 그 시간은 게임에 남습니다. 한 번 실패해 봤기에 다음에는 다른 선택을 할 수 있으니까요. 저는 게임의 깊이가 그렇게 쌓인다고 믿습니다.",
    "by": "lian"
  },
  "intro": [
    "LaoDeer는 게임을 만들며 내린 선택 하나하나에 자기 이름을 거는 인디 게임 스튜디오입니다. 아이디어가 생기면 직접 플레이할 수 있는 형태로 만들고, 예상과 다른 지점에서 다시 고민합니다. 무엇을 남기고 무엇을 덜어낼지, 그 판단을 쌓아 우리만의 게임을 만듭니다."
  ],
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
      "q": "몇 명으로 구성된 팀인가요?",
      "a": "현재는 혼자 개발하고 있어요"
    },
    {
      "q": "연락하고싶어요!",
      "a": "연락은 디스코드 @lian_619 로 연락주시면 빠른 대응이 가능합니다"
    }
  ],
  "pressContact": "laodeercompany@gmail.com"
};
