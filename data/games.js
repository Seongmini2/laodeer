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
    "id": "itch-io",
    "title": "Sleeve it!",
    "intro": "당신의 운과 정확도를 시험하세요!",
    "status": "출시",
    "released": "2026년 11월 14일",
    "developer": "20초 게임잼으로 시작한 카드보관 스피드런 캐주얼 게임",
    "publisher": "LaoDeer",
    "platforms": [
      "PC"
    ],
    "stores": [
      {
        "label": "itch.io",
        "url": "https://laodeer.itch.io/sleeve-it"
      }
    ],
    "itch": "https://laodeer.itch.io/sleeve-it",
    "image": "images/2026/game-itch-io-0t8c.png",
    "screenshots": [
      "https://www.youtube.com/watch?v=C_ayRr6l71Q",
      "images/2026/shot-itch-io-t7rh.png",
      "images/2026/shot-itch-io-lwoe.png",
      "images/2026/shot-itch-io-7rcj.png",
      "images/2026/shot-itch-io-msh2.png",
      "images/2026/shot-itch-io-fjpe.png",
      "images/2026/shot-itch-io-57m6.png",
      "images/2026/shot-itch-io-jfpk.png"
    ]
  },
  {
    "id": "soul",
    "title": "SOUL",
    "intro": "속성을 사용하는 퍼즐 메트로베니아",
    "status": "개발 중",
    "released": "미정",
    "devPeriod": "2025년 말 ~",
    "developer": "속성을 이용한 메트로베니아 2D 액션 게임",
    "publisher": "LaoDeer",
    "platforms": [
      "PC"
    ],
    "stores": [
      {
        "label": "Steam",
        "url": "#"
      }
    ],
    "image": "images/2026/game-soul-c408.png"
  },
  {
    "id": "under-jacpot",
    "title": "Under-Jacpot",
    "intro": "카지노에서 끝없이 몰려오는 적을 상대하세요!",
    "status": "개발 중",
    "released": "미정",
    "devPeriod": "2026년 11월 25일 ~",
    "developer": "카지노를 배경으로 한 1인칭 FPS 로그라이크 \"Under-Jacpot\"",
    "publisher": "LaoDeer",
    "platforms": [
      "PC"
    ],
    "image": "images/2026/game-under-jacpot-uutm.png"
  }
];
