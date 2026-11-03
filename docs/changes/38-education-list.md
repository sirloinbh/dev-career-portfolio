# #38 학력 목록 화면과 메뉴

이슈: <https://github.com/sirloinbh/dev-career-portfolio/issues/38>

## 목적

#31 API의 학력 데이터를 화면에서 봅니다. 나머지 항목의 목록 화면이 따를 파일 구조를 정합니다.

## 변경

- `frontend/src/app.tsx`: `pages.educations = '/educations'`, 메뉴 "학력"(아이콘 `GraduationCap`), 경로 연결.
- `frontend/src/education-data.ts`: `Education` 타입, 학위·상태 한국어 이름, 기간·학점 문구, `educationApi.list`.
- `frontend/src/educations.tsx`: `EducationList` 화면. 로딩은 `SkeletonList`, 빈 목록은 `EmptyState`, 오류는 `Notice`(`role="alert"`)입니다.
- `frontend/src/use-load.ts`: 화면이 처음 불러올 때 쓰는 `useLoad`. 형제 앱 cert-manager의 같은 이름 훅과 동작이 같습니다.
- `frontend/src/educations.test.tsx`: 메뉴 이동, 목록 표시, 로딩·빈 목록·오류 상태 테스트.

## 다음 항목이 따를 화면 구조

1. `frontend/src/<단수형>-data.ts`: 응답 타입, 코드값의 한국어 이름, 표시 문구 함수, `<단수형>Api` 객체. 화면 없이 테스트할 수 있는 규칙은 여기에 둡니다.
2. `frontend/src/<복수형>.tsx`: 화면 컴포넌트(`<이름>List`, 이후 폼). `h1`은 페이지마다 하나이고 항목 제목은 `h2`입니다.
3. 불러오기는 `useLoad`로 하고 상태를 네 가지로 그립니다: 로딩 `SkeletonList`(`aria-busy`와 이름), 오류 `Notice`, 빈 목록 `EmptyState`, 목록 `ul`(`aria-label="<이름> 목록"`).
4. 오류 문구는 "<무엇>을 불러오지 못했습니다. <원인>"입니다. 원인은 서버의 한국어 `error`이고, 서버 문구가 없는 프록시 오류에도 무엇이 실패했는지 보이게 합니다.
5. `app.tsx`의 `pages`에 경로를, `nav`에 메뉴를 추가합니다.
6. 테스트는 `fetch`를 주소별로 바꿔 `App`을 그 경로에서 렌더링합니다.

## 판단한 내용

- **기간 글자 크기:** 디자인 시스템은 날짜 같은 메타 정보에 `text-meta`(12px)를 쓰라고 하지만, 학력에서 기간은 핵심 정보이고 UX 점검표는 13px 미만 본문을 막습니다. 기간 줄은 `text-body-sm`으로 했습니다.
- **오류 문구:** 처음에는 `errorText`의 결과만 보였는데, API가 꺼지면 중앙 `requestJson`의 기본 문구 "요청을 처리하지 못했습니다"만 남았습니다. 브라우저 확인에서 발견해 "학력을 불러오지 못했습니다."를 앞에 붙였습니다.
- **정렬:** 화면은 API가 준 순서(입학일 최신 순)를 그대로 씁니다.
- 추가 버튼과 수정·삭제는 #39에서 만듭니다.

## 검증

- `npm run check`: 결과는 PR 본문에 기록합니다.
- 실제 브라우저: 설치된 Chrome(헤드리스)을 Chrome DevTools 프로토콜로 직접 조작했습니다. Claude in Chrome 확장이 연결되지 않았고 저장소에 Playwright가 없어서입니다. 개발 서버(API 3108, Vite 5208)를 임시 PostgreSQL 17의 `career_test`에 붙이고, 지어낸 학력 3건을 API로 넣었습니다.

| 상태     | 390×844                                                                 | 1440×900                           |
| -------- | ----------------------------------------------------------------------- | ---------------------------------- |
| 목록 3건 | 가로 넘침 없음, 13px 미만 글자 없음, 입학일 최신 순, 대학원은 "재학 중" | 같음, 라이트·다크 모두 글자 구분됨 |
| 빈 목록  | "아직 등록한 학력이 없습니다" 표시                                      | 같음                               |
| API 중지 | "학력을 불러오지 못했습니다. 요청을 처리하지 못했습니다" 경고           | 같음                               |

- 키보드: `Tab`으로 본문 건너뛰기 → 앱 이름 → 화면 모드 → 대시보드 → 학력 → 설정 순으로 이동하고, 모두 포커스 표시가 보였습니다. 콘솔 오류는 없었습니다.
- 44px 미만 누름 대상: 공통 레이아웃의 메뉴 열기·화면 모드 버튼(36px), 본문 건너뛰기 링크입니다. 이 화면이 추가한 누름 대상은 없습니다. 공통 레이아웃은 중앙 관리 파일이라 여기서 고치지 않습니다.

스크린샷(지어낸 데이터): [목록 390 라이트](38-education-list/list-390-light.png), [목록 1440 다크](38-education-list/list-1440-dark.png), [빈 목록 390](38-education-list/empty-390-light.png), [오류 390](38-education-list/error-390-light.png)

## 한계

- 실제 휴대폰과 axe 검사는 하지 않았습니다. 이 저장소의 e2e(axe 포함)는 아직 꺼져 있습니다.
- Docker Compose 실행은 이 PC에서 확인할 수 없습니다(BIOS 가상화 꺼짐).
