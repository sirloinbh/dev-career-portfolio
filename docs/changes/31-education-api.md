# #31 학력 저장 API와 테이블

이슈: <https://github.com/sirloinbh/dev-career-portfolio/issues/31>

## 목적

학력을 저장하는 테이블과 API를 만들고, 나머지 포트폴리오 항목이 따라 할 백엔드 구조를 정합니다. 입력 항목은 추천안대로 확정했고 이슈 코멘트에 기록했습니다.

## 변경

- `database/migrations/002_educations.sql`: `educations` 테이블. 기간 순서와 학점 범위를 DB 제약으로도 막습니다.
- `backend/src/routes/educations.ts`: `GET`·`POST /api/educations`, `PUT`·`DELETE /api/educations/:id`.
- `backend/src/routes/shared.ts`: 항목들이 함께 쓰는 날짜·문자열 입력 검증 도우미.
- `backend/src/app.ts`: 직접 쓰던 오류 처리를 중앙 관리 파일 `standard/http.ts`의 `notFound`, `errorHandler`로 바꿨습니다.
- `backend/test/helpers.ts`: `withApi`가 메서드와 본문을 받습니다. `testDatabaseUrl()`을 추가했습니다.

## 다음 항목이 따를 백엔드 구조

1. `database/migrations/NNN_<복수형>.sql`에 테이블을 추가합니다. 끝나지 않은 기간은 NULL로 둡니다.
2. `backend/src/routes/<복수형>.ts`에 `register<이름>Routes(app, pool)`를 만들고 `app.ts`의 `notFound` 앞에 등록합니다.
3. 입력은 처리 함수 첫 줄에서 Zod `parse()`로 검증합니다. 메시지는 한국어로 지정합니다.
4. 응답은 `{ "<복수형>": [...] }`, `{ "<단수형>": {...} }`로 감쌉니다. 생성은 201, 삭제는 204입니다. 없는 대상은 `HttpError(404, …)`입니다.
5. `bigint`, `numeric`은 pg가 문자열로 주므로 숫자로 바꿔 응답합니다.
6. 테스트는 DB 없는 입력 검증(`<복수형>.test.ts`)과 실제 DB 통합(`<복수형>.integration.test.ts`)으로 나눕니다.

## 판단한 내용

- **테스트 DB 보호:** 이 PC의 사용자 환경변수 `TEST_DATABASE_URL`은 다른 프로젝트의 `study_test`를 가리킵니다. 통합 테스트가 행을 지우므로, DB 이름이 `career_test`일 때만 실행하고 그 밖에는 건너뜁니다. 기존 기준선 테스트도 같은 도우미를 씁니다.
- **단건 조회 API는 만들지 않았습니다.** 수정 화면은 목록 데이터를 쓸 수 있어 지금 쓰는 곳이 없습니다.

## 검증

`docs/changes/`의 결과는 PR 본문에도 함께 기록합니다.

- `npm run check`: 통과.
- 임시 PostgreSQL 17의 `career_test`로 `npm test -w backend`: 통과. DB 통합 테스트를 건너뛰지 않았습니다.
- `002_educations.sql` 2회 적용: 오류 없음.

## 한계

Docker를 쓸 수 없는 PC(BIOS 가상화 꺼짐)라 Compose 실행은 확인하지 못했습니다. Docker 이미지 빌드는 CI 결과로 확인합니다. 화면은 #38, #39에서 만듭니다.
