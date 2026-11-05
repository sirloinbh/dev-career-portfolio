# #58 minimatch 취약점 경고 해결 (11.x 강제)

이슈: <https://github.com/sirloinbh/dev-career-portfolio/issues/58>

## 목적

[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)(중간 등급)를 해결합니다. `minimatch` 11.0.1 미만은 `optimizationLevel`이 2 이상일 때 공격자가 만든 glob 패턴으로 전처리 단계의 패턴 수를 불려 CPU·메모리를 크게 쓰게 할 수 있습니다. 이 권고는 처음 Dependabot 경고 #7로 올라왔지만, 작업 중 GitHub 쪽에서 경고 #7을 철회했습니다(`dependabot/alerts/7`이 HTTP 410 "Alert number 7 has been withdrawn"). 권고 자체는 유효합니다(`withdrawn_at: null`). 그래서 해결 여부는 `npm audit`으로 확인합니다.

## 원인

- 이 리포에는 개발 의존성으로 `minimatch@10.2.6` 한 벌이 있었습니다. `eslint`, `@eslint/config-array`(eslint 아래), `@typescript-eslint/typescript-estree`(typescript-eslint 아래), `eslint-plugin-jsx-a11y-x`가 씁니다. `node_modules` 전체에서 minimatch를 불러오는 곳은 이 넷뿐입니다.
- 수정판은 11.x에만 있는데, 위 패키지는 최신판도 `minimatch@^10`을 요구합니다(eslint 10.14.0 `^10.2.6`, config-array 0.23.5 `^10.2.4`, typescript-estree 8.72.1 `^10.2.2`, jsx-a11y-x 0.2.0 `^10.2.5`). 그래서 패키지를 올리는 것만으로는 해결되지 않습니다.
- 실제 위험은 낮습니다. 네 패키지 모두 `optimizationLevel`을 정하지 않아 기본값 1로 동작해 취약한 경로를 지나지 않고, 패턴도 eslint 설정처럼 이 리포가 쓴 것뿐입니다.

## 변경

- `package.json`: `overrides`로 `eslint`, `typescript-eslint`, `eslint-plugin-jsx-a11y-x` 아래의 `minimatch`만 `11.0.4`로 고정합니다. `package.json`의 중앙 관리 대상은 정해진 필드뿐이라 `overrides`는 이 리포가 정할 수 있습니다(`npm run standards:check` 통과).
- `package-lock.json`: `minimatch` 10.2.6 → 11.0.4(engines가 `18 || 20 || >=22`에서 `20 || >=22`로 좁아지지만 Node 24.21.0이라 영향 없음), 새 하위 의존성 `@isaacs/nonrecursive-glob-match@1.0.3`(BlueOak-1.0.0, 의존성·설치 스크립트 없음). 사용자가 `npm install --ignore-scripts`로 갱신했습니다(에이전트 훅이 설치 명령을 막음). `frontend/`·`backend/` 잠금 파일에는 `minimatch`가 없어 바뀌지 않고, 이 잠금 파일로 `npm ci`하는 Docker 빌드도 영향이 없습니다.

## 판단한 내용

- **override를 쓴 이유:** 사용자와 확인해(2026-11-04) 경고를 무시 처리하는 대신 11.x를 강제하기로 했습니다.
- **범위를 eslint 계열로 좁힌 이유:** 리포 전체에 걸면, 나중에 minimatch 3·5·9를 쓰는 패키지(glob, 커버리지 도구 등)가 들어올 때 말없이 11을 받습니다. 11.0은 `Minimatch.set` 항목을 RegExp에서 `Matcher`로 바꾸고 `makeRe()`를 없애 그런 패키지가 실행 중에 깨질 수 있고, `npm ls`도 이를 잡지 못합니다.
- **정확한 판(`11.0.4`)으로 고정한 이유:** `.npmrc`가 `save-exact=true`이고 다른 개발 의존성도 모두 정확한 판입니다. minimatch는 10.2.3 같은 패치판에서도 매칭 동작이 바뀐 적이 있어, 다음 `npm install`에서 말없이 다른 11.x가 들어오지 않게 합니다.
- **11.0의 호환성:** 네 패키지는 `new Minimatch(pattern, { dot: true[, flipNegate] })`, `.match(path[, partial])`, `.pattern`, `minimatch(path, pattern[, { dot: true }])`만 씁니다. 11.0의 바뀐 점과 영향은 다음과 같습니다.
  - `makeRe()`, `Minimatch#regexp`, `AST`, `debug`, `matchOne()` 등 제거: 네 패키지 모두 쓰지 않음.
  - `Minimatch.set` 항목이 RegExp 대신 문자열·`Matcher`·`GLOBSTAR`: `.set`을 읽는 곳이 없음.
  - `a/b/`처럼 끝이 빈 경로 조각은 빈 패턴 조각에만 맞음, Windows에서 `..`가 드라이브 문자·UNC 앞부분을 지우지 않음: eslint 설정 패턴에 해당하는 것이 없음.
  - `**`가 여럿인 패턴과 `partial` 매칭 버그 수정: eslint의 파일 선택이 달라지는지 아래처럼 직접 비교했습니다.
- **override를 지울 때:** eslint 계열이 모두 `minimatch@^11`을 받게 되면 지웁니다. 잊지 않도록 [#62](https://github.com/sirloinbh/dev-career-portfolio/issues/62)로 등록했습니다.

## 검증

- `npm ls minimatch --all`: 네 패키지 모두 `minimatch@11.0.4`(10.x 없음). `npm ls --all` 종료 코드 0(잘못된 의존성 없음).
- `npm audit`: `found 0 vulnerabilities`(main의 잠금 파일은 minimatch 때문에 중간 등급 12건).
- `node .standards/lockfiles.mjs`: `frontend`·`backend` 잠금 파일이 루트와 같음.
- **eslint 결과 전후 비교:** 같은 작업 트리에서 `npm ci --ignore-scripts`로 10.2.6과 11.0.4를 번갈아 설치하고 같은 스크립트로 기록해 `diff -r`로 비교했습니다. 결과는 완전히 같았습니다.
  - 검사한 파일 목록: 85개, 같음(`.standards/**` 제외도 같음).
  - eslint 메시지: 둘 다 0건.
  - `--print-config`로 본 규칙·설정: 표본 9개 파일(`frontend/src/app.tsx`, 화면 테스트, `components/ui`, `test/setup.ts`, `backend/src/app.ts`, 백엔드 테스트, `scripts/*.mjs`, `vite.config.ts`, `eslint.config.mjs`)에서 같음.
- **오류를 여전히 잡는지:** 11.0.4에서 일부러 규칙을 어긴 임시 파일을 검사해 `no-unused-vars`, `simple-import-sort/imports`, `jsx-a11y-x/alt-text`, `jsx-a11y-x/label-has-associated-control`(minimatch를 직접 쓰는 규칙), `click-events-have-key-events`, `no-static-element-interactions`를 모두 잡는 것을 확인하고 파일을 지웠습니다.
- `npm run check`: 통과(종료 코드 0). 백엔드 46건 중 36건 통과·10건 건너뜀(이 PC에 PostgreSQL이 없어 DB 통합 테스트 건너뜀), 프론트엔드 87건 통과·2건 건너뜀, 스킬 검사 4건 통과, 빌드 통과.
- CI(첫 커밋 4e25140): `verify`에서 백엔드 46건 통과·건너뜀 0건(DB 통합 테스트 포함)과 `npm run knip`(knip-strict) 통과, `docker-build` 통과.

## 1차 리뷰 반영

| 지적                                                                                                  | 반영                                                                                    |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| (낮음) `"minimatch": "^11.0.4"`가 리포 전체에 걸려, 다른 판을 쓰는 패키지가 들어오면 말없이 11을 받음 | eslint·typescript-eslint·jsx-a11y-x 아래로 범위를 좁힘                                  |
| (낮음) `^` 범위가 리포의 정확한 판 고정 관례(`save-exact=true`)와 다름                                | `11.0.4`로 고정                                                                         |
| (낮음) Dependabot 경고 #7이 철회돼 "병합 뒤 경고 #7이 닫힌다"는 완료 기준을 확인할 수 없음            | 목적과 완료 확인을 권고 ID와 `npm audit` 기준으로 고치고, #58 이슈 코멘트에 기록        |
| (낮음) 호환성 설명에 `Minimatch.set` 변경, 빈 경로 조각·Windows `..` 변경이 빠짐. 위험 설명이 모호함  | 판단한 내용에 항목별로 적고, 취약 경로가 `optimizationLevel >= 2`에서만 동작한다고 적음 |
| (낮음) knip 한계가 오래됨(CI에서 통과함), `oxc-resolver`가 들어온 날짜가 틀림. engines 변화가 빠짐    | 한계와 변경 절을 고침                                                                   |
| (참고) override를 지울 때를 알려 주는 장치가 없음                                                     | [#62](https://github.com/sirloinbh/dev-career-portfolio/issues/62)로 분리               |

범위를 좁힌 override 검증:

- 잠금 파일은 그대로이고 `npm ci --ignore-scripts`가 통과합니다(0 vulnerabilities). `npm ls --all` 종료 코드 0.
- override가 실제로 적용되는지: 새 `package.json`과 main의 잠금 파일(10.2.6)로 `npm ci --dry-run`을 실행하면 `Invalid: lock file's minimatch@10.2.6 does not satisfy minimatch@11.0.4`로 거절됩니다.
- `npm run check`: 통과(종료 코드 0, 위와 같은 건수). `npm run standards:check` 통과, 하위 잠금 파일이 루트와 같음.

## 한계

- `npm run knip`을 이 PC에서 실행하지 못했습니다. `oxc-resolver@11.24.2`의 Windows 네이티브 모듈 파일은 있지만 `The specified module could not be found`로 불러오지 못합니다(같은 계열의 `oxc-parser`는 불러옴). `oxc-resolver`는 2026-10-29(967c082)부터 잠금 파일에서 바뀌지 않았고 `minimatch`와 관계가 없어 이 PC 환경 문제로 봅니다. knip은 CI `verify`에서 통과했습니다.
