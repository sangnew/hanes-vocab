# 한글×Español 단어장

한국어를 공부하는 나와 스페인어를 공부하는 친구가 같이 채워나가는 카테고리별 단어/문장집.

- 각 항목: 한국어 + 영문 발음 표기, Español + English meaning
- 카테고리(업무/일상생활 대화/음식/카페 등)와 각 카테고리 안의 단어/문장은 사이트에서 바로 추가·수정·삭제됨
- 데이터는 Firebase Firestore에 저장 (Busan/Jeju 여행 사이트와 같은 프로젝트, 별도 콜렉션만 사용 — 새 Firebase 프로젝트 설정 불필요)
- 로그인 없음 — 링크를 아는 사람은 누구나 보고 추가할 수 있음 (가족 여행 사이트와 동일한 방식)

## 로컬 구조
- `index.html` / `style.css` / `app.js` — 정적 사이트, 빌드 과정 없음
- `config.js` — Firebase 프로젝트 설정값 (공개되어도 안전, 접근 제어는 Firestore 규칙으로)

GitHub Pages로 배포됨.
