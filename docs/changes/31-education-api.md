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

## 요청 횟수 제한

첫 PR에서 CodeQL이 `js/missing-rate-limiting`으로 실패했습니다. DB를 쓰는 API에 Express 수준의 제한이 없다는 경고이고, nginx 제한은 인식하지 못합니다. 사용자가 패키지 설치를 선택해 `express-rate-limit@8.7.2`를 추가했습니다. 값은 형제 앱과 같은 분당 1200회이고, nginx가 접속자별로 초당 10회를 먼저 막습니다. API는 프록시를 신뢰하지 않으므로 nginx를 거친 요청은 모두 같은 주소로 계산됩니다. 즉 이 값은 접속자별이 아니라 전체 합계 제한이며, 사용자가 한 명인 앱이라 이대로 둡니다. 코드는 `backend/src/rate-limit.ts`이고 테스트는 `backend/test/rate-limit.test.ts`입니다.

## 1차 자동 리뷰

보완점이 나와 추가 커밋으로 반영했습니다.

| 지적                                  | 조치                                                            |
| ------------------------------------- | --------------------------------------------------------------- |
| 연도 0000이 500으로 끝남              | `calendarDate`에서 400으로 거절. 이후 항목도 이 도우미를 씁니다 |
| 재학 중인데 졸업일 저장 가능          | API 검증과 DB 제약 `educations_enrolled_open` 추가              |
| 잘못된 날짜에 순서 오류까지 함께 표시 | 날짜 검증에 `abort`를 넣어 해당 오류만 표시                     |
| DB가 만점 100 초과를 허용             | `educations_gpa_range`에 `gpa_scale <= 100` 추가                |
| 정렬 테스트가 id 순으로도 통과        | 시작일이 늦은 행을 먼저 넣도록 변경                             |
| 테스트 누락                           | 만점 한도, 수정 검증, NUL 문자, DB 제약 테스트 추가             |

깨진 JSON 본문 테스트는 추가하지 않았습니다. 중앙 관리 파일 `standard/http.ts`의 동작이고 리뷰어가 400을 직접 확인했습니다. CodeQL 경고는 위 요청 횟수 제한으로 해결합니다.

## 2차 자동 리뷰

1차 보완이 맞게 반영됐는지 확인했고, 보완점 2건을 추가 커밋으로 반영했습니다. 리뷰는 2회까지이므로 3차 리뷰는 하지 않습니다.

| 지적                                                          | 조치                                                               |
| ------------------------------------------------------------- | ------------------------------------------------------------------ |
| 정렬 테스트가 `ORDER BY` 없이도 통과함(삽입 순 = id 오름차순) | 시작일 2019 → 2024 → 2015 순으로 넣고 2024, 2019, 2015 순서를 확인 |
| 요청 횟수 제한을 접속자별 제한처럼 설명함(실제는 전체 합계)   | `rate-limit.ts` 주석과 이 문서의 설명을 고침                       |

범위 밖 사항: `deploy/remote-deploy.sh`가 없는 `dist/migrate.js`를 실행하고, `compose.yaml`은 새 볼륨에서만 마이그레이션을 적용합니다. 둘 다 중앙 관리 파일이고 main에도 있는 문제라 이 PR에서 고치지 않습니다. 첫 배포 전에 중앙 리포에서 다뤄야 합니다.

## 판단한 내용

- **테스트 DB 보호:** 이 PC의 사용자 환경변수 `TEST_DATABASE_URL`은 다른 프로젝트의 `study_test`를 가리킵니다. 통합 테스트가 행을 지우므로, DB 이름이 `career_test`일 때만 실행하고 그 밖에는 건너뜁니다. 기존 기준선 테스트도 같은 도우미를 씁니다.
- **단건 조회 API는 만들지 않았습니다.** 수정 화면은 목록 데이터를 쓸 수 있어 지금 쓰는 곳이 없습니다.

## 검증

`docs/changes/`의 결과는 PR 본문에도 함께 기록합니다.

- `npm run check`: 통과.
- 임시 PostgreSQL 17의 `career_test`로 `npm test -w backend`: 통과. DB 통합 테스트를 건너뛰지 않았습니다.
- `002_educations.sql` 2회 적용: 오류 없음.

2차 리뷰 보완 커밋:

- `npm run check`: 통과. 백엔드 24건 중 20건 통과, 4건 건너뜀(이 PC에 `career_test`가 없어 DB 통합 테스트 건너뜀). 프론트엔드 58건 통과, 2건 건너뜀(기존 테마 조건부 테스트).
- 바뀐 정렬 테스트는 DB 통합 테스트라 로컬에서 실행하지 못했습니다. CI의 `career_test`(PostgreSQL 17) 결과로 확인합니다.
- `npm run standards:check`: 통과. `npm run knip`: 이 PC에서 `oxc-resolver` 네이티브 모듈을 불러오지 못해 실행하지 못했습니다. 내보내기 변경이 없고 CI에서 실행됩니다.

## 한계

Docker를 쓸 수 없는 PC(BIOS 가상화 꺼짐)라 Compose 실행은 확인하지 못했습니다. Docker 이미지 빌드는 CI 결과로 확인합니다. 화면은 #38, #39에서 만듭니다.
