/*
  게임 목록 (목록 순서 = 화면 순서)
  관리 화면(admin.html)의 "게임" 탭에서 고치는 걸 권해요.

  id         : 주소와 기록 연결에 쓰는 짧은 영문 이름 (예: "soul")
  title      : 게임 이름
  intro      : 어떤 게임인지 알려주는 짧은 소개
  status     : "출시" | "개발 중" | "공개 예정"   ("공개 예정"은 Coming Soon 카드로만 보여요)
  released   : 출시일 (적은 그대로 표시)
  devPeriod  : 개발 기간
  developer  : 개발
  publisher  : 퍼블리셔
  platforms  : ["플랫폼", ...]
  stores     : [{ label: "버튼 글자", url: "https://..." }, ...]
  image      : 대표 장면 이미지
  alt        : 대표 장면 설명
*/
window.LAODEER_GAMES = [
  {
    "id": "soul",
    "title": "SOUL",
    "intro": "Use elemental souls to solve puzzles and uncover a story told without words in this atmospheric 2.5D adventure.",
    "status": "개발 중",
    "released": "미정",
    "devPeriod": "2025년 말 ~",
    "developer": "Jeon Seong min",
    "publisher": "LaoDeer",
    "image": "assets/examples/key-scene.svg",
    "alt": "SOUL 대표 장면"
  },
  { "id": "coming-1", "title": "Coming Soon..", "status": "공개 예정" },
  { "id": "coming-2", "title": "Coming Soon..", "status": "공개 예정" }
];
