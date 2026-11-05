# #36 지원 기업 저장 API와 테이블

이슈: <https://github.com/sirloinbh/dev-career-portfolio/issues/36>

## 목적

자기소개서를 기업별로 관리하기 전에, 자기소개서가 속할 지원 기업을 저장하는 테이블과 조회·등록·수정·삭제 API를 만듭니다. #31에서 정한 백엔드 구조를 따릅니다. 입력 항목은 사용자와 확인해 [이슈 코멘트](https://github.com/sirloinbh/dev-career-portfolio/issues/36#issuecomment-6650724502)에 기록했습니다. 결정 사항은 모두 추천안입니다.

## 변경

- `database/migrations/007_applications.sql`: `applications` 테이블. 빈 기업명, 3종 밖의 상태, http(s)가 아닌 공고 링크를 DB 제약으로도 막습니다.
- `backend/src/routes/applications.ts`: `GET`·`POST /api/applications`, `PUT`·`DELETE /api/applications/:id`.
- `backend/src/app.ts`: 지원 기업 경로 등록.
- `backend/test/applications.test.ts`: DB 없이 입력 검증과 NULL 전달. `backend/test/applications.integration.test.ts`: `career_test` DB 통합.

## API

| 항목           | 이름          | 규칙                                                                                |
| -------------- | ------------- | ----------------------------------------------------------------------------------- |
| 기업명         | `companyName` | 필수, 100자 이하, 앞뒤 공백 제거. 비어 있으면 400 "기업명을(를) 입력해 주세요"      |
| 지원 직무      | `position`    | 선택, 100자 이하. 빈 값은 `null`                                                    |
| 채용 공고 링크 | `postingUrl`  | 선택, `http://`·`https://` 주소만, 500자 이하, 공백 불가(프로젝트 링크와 같은 규칙) |
| 마감일         | `deadline`    | 선택, `YYYY-MM-DD`. 없으면 `null`. 지난 날짜도 받음                                 |
| 지원 상태      | `status`      | 필수. `drafting`(작성 중), `submitted`(제출 완료), `closed`(종료)                   |
| 메모           | `memo`        | 선택, 2000자 이하. 빈 값은 `null`                                                   |

- 응답은 `{ "applications": [...] }`, `{ "application": {...} }`입니다. 생성은 201, 삭제는 204, 없는 대상은 404 "지원 기업을 찾을 수 없습니다"입니다.
- 목록은 상태(작성 중 → 제출 완료 → 종료) → 마감일이 가까운 순(없으면 뒤) → 나중에 등록한 것이 위입니다.

## 판단한 내용

- **이름은 `applications`입니다.** 한 행은 "한 기업의 한 직무 지원"이고, 같은 기업의 다른 직무·다른 시기 지원은 별도 행입니다. 기업 자체를 뜻하는 `companies`로 부르면 같은 기업이 여러 행에 나오는 것이 어색해서 지원 단위 이름을 골랐습니다. 화면에서는 "지원 기업"으로 부릅니다. #37의 자기소개서 문항은 이 행에 속합니다.
- **중복은 막지 않습니다.** 기업명·직무가 모두 같은 지원도 각각 저장합니다.
- **지난 마감일도 저장합니다.** 지난 지원 기록이므로 거절하지 않습니다.
- **공고 링크는 프로젝트 링크와 같은 `optionalLink`를 씁니다.** `javascript:` 같은 주소가 화면에서 열리지 않게 http(s)만 받습니다.
- **마이그레이션 번호:** `007`을 예약했습니다.

## 검증

이 PC에 Docker로 띄운 PostgreSQL 17에서 확인했습니다.

- `007_applications.sql`을 `career`와 `career_test`에 각각 두 번 적용: 모두 종료 코드 0. 두 번째에는 `relation "applications" already exists, skipping` 알림만 나왔습니다.
- `TEST_DATABASE_URL`을 `career_test`로 두고 `npm test -w backend`: 78건 모두 통과, 건너뜀 0건. 새 테스트는 단위 8건, DB 통합 2건입니다.
  - 단위: 빈칸·공백·누락·`null`·101자 기업명, 3종 밖의 상태(`Drafting`처럼 대소문자가 다른 값 포함), http(s)가 아니거나 공백이 든 공고 링크, 잘못된·빈 마감일, 101자 직무, 2001자 메모, 객체가 아닌 본문, 잘못된 id를 쿼리 전에 400으로 거절. 수정도 같은 검증. 빈 선택 항목과 마감일 누락은 쿼리에 `null`로 전달.
  - 통합: 마감일 없는 행이 DB에 NULL로 저장됨, 같은 기업·직무 중복 등록 허용, 지난 마감일 저장, 정렬(상태 → 마감일 가까운 순·없음은 뒤 → 최근 등록), 모든 열 수정과 링크·마감일 비우기, DB가 거절한 수정(NUL 문자) 뒤 원래 행 유지, 삭제, 404, DB 제약(빈 기업명·상태·공고 링크).
- `npm run check`(같은 `career_test`): 통과(종료 코드 0). 백엔드 78건 통과·건너뜀 0건, 프론트엔드 87건 통과·2건 건너뜀(기존 테마 조건부 테스트), 스킬 검사 4건 통과, 빌드 통과.
- `npm run knip`: 통과.

## 한계

화면은 #48(목록), #49(등록·수정·삭제)에서 만듭니다. 기업 삭제 시 자기소개서 문항 처리는 #37에서 정합니다.
