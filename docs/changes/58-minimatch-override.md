# #58 minimatch 취약점 경고 해결 (11.x 강제)

이슈: <https://github.com/sirloinbh/dev-career-portfolio/issues/58>

## 목적

Dependabot 경고 #7([GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), 중간 등급)을 해결합니다. `minimatch` 11.0.1 미만은 공격자가 만든 glob 패턴으로 전처리 단계의 패턴 수를 불려 CPU·메모리를 크게 쓰게 할 수 있습니다.

## 원인

- 이 리포에는 개발 의존성으로 `minimatch@10.2.6` 한 벌이 있었습니다. `eslint`, `@eslint/config-array`, `@typescript-eslint/typescript-estree`, `eslint-plugin-jsx-a11y-x`가 씁니다.
- 수정판은 11.x에만 있는데, 위 패키지는 최신판(eslint 10.14.0 포함)도 `minimatch@^10`을 요구합니다. 그래서 패키지를 올리는 것만으로는 해결되지 않습니다.

## 변경

- `package.json`: `"overrides": { "minimatch": "^11.0.4" }`. `package.json`의 중앙 관리 대상은 정해진 필드뿐이라 `overrides`는 이 리포가 정할 수 있습니다(`npm run standards:check` 통과).
- `package-lock.json`: `minimatch` 10.2.6 → 11.0.4, 새 하위 의존성 `@isaacs/nonrecursive-glob-match@1.0.3`. 사용자가 `npm install --ignore-scripts`로 갱신했습니다(에이전트 훅이 설치 명령을 막음). `frontend/`·`backend/` 잠금 파일에는 `minimatch`가 없어 바뀌지 않습니다.

## 판단한 내용

- **override를 쓴 이유:** 사용자와 확인해(2026-11-04) 경고를 무시 처리하는 대신 11.x를 강제하기로 했습니다. 실제 위험은 낮습니다. 이 리포의 glob 패턴은 eslint 설정처럼 우리가 쓴 것뿐입니다. 그래도 경고를 남겨 두지 않으려고 강제했습니다.
- **11.0의 호환성:** 11.0은 `makeRe()`, `Minimatch#regexp`, `AST`, `debug` 같은 API를 없앴습니다. 위 4개 패키지는 공개 API인 `new Minimatch(pattern, options).match(path, partial)`와 `minimatch(path, pattern, options)`만 씁니다. 11.0에는 `**`가 여럿인 패턴과 `partial` 매칭의 버그 수정도 들어 있어, eslint의 파일 선택이 달라지는지 아래처럼 직접 비교했습니다.
- **override를 지울 때:** eslint·typescript-eslint·eslint-plugin-jsx-a11y-x가 모두 `minimatch@^11`을 받게 되면 override를 지웁니다.

## 검증

- `npm ls minimatch --all`: 네 패키지 모두 `minimatch@11.0.4`(10.x 없음). `npm ls --all` 종료 코드 0(잘못된 의존성 없음).
- `npm audit`: `found 0 vulnerabilities`.
- `node .standards/lockfiles.mjs`: `frontend`·`backend` 잠금 파일이 루트와 같음.
- **eslint 결과 전후 비교:** 같은 작업 트리에서 `npm ci --ignore-scripts`로 10.2.6과 11.0.4를 번갈아 설치하고 같은 스크립트로 기록해 `diff -r`로 비교했습니다. 결과는 완전히 같았습니다.
  - 검사한 파일 목록: 85개, 같음(`.standards/**` 제외도 같음).
  - eslint 메시지: 둘 다 0건.
  - `--print-config`로 본 규칙·설정: 표본 9개 파일(`frontend/src/app.tsx`, 화면 테스트, `components/ui`, `test/setup.ts`, `backend/src/app.ts`, 백엔드 테스트, `scripts/*.mjs`, `vite.config.ts`, `eslint.config.mjs`)에서 같음.
- **오류를 여전히 잡는지:** 11.0.4에서 일부러 규칙을 어긴 임시 파일을 검사해 `no-unused-vars`, `simple-import-sort/imports`, `jsx-a11y-x/alt-text`, `jsx-a11y-x/label-has-associated-control`(minimatch를 직접 쓰는 규칙), `click-events-have-key-events`, `no-static-element-interactions`를 모두 잡는 것을 확인하고 파일을 지웠습니다.
- `npm run check`: 통과(종료 코드 0). 백엔드 46건 중 36건 통과·10건 건너뜀(이 PC에 PostgreSQL이 없어 DB 통합 테스트 건너뜀, CI `verify`에서 확인), 프론트엔드 87건 통과·2건 건너뜀, 스킬 검사 4건 통과, 빌드 통과.

## 한계

- `npm run knip`을 이 PC에서 실행하지 못했습니다. `oxc-resolver@11.24.2`의 Windows 네이티브 모듈 파일은 있지만 `The specified module could not be found`로 불러오지 못합니다(같은 계열의 `oxc-parser`는 불러옴). `oxc-resolver`는 11/2부터 잠금 파일에서 바뀌지 않았고 `minimatch`와 관계가 없어, 이 PC 환경 문제로 보고 CI의 knip 검사로 확인합니다.
- Dependabot 경고가 닫히는 것은 병합 뒤 GitHub가 기본 브랜치를 다시 검사해야 확인할 수 있습니다.
