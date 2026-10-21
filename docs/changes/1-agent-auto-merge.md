# #1 에이전트 PR 병합 정책으로 변경

- 이슈: [#1](https://github.com/sirloinbh/dev-career-portfolio/issues/1)
- 일자: 2026-10-21 (Asia/Seoul)

## 목적

저장소 소유자 요청(2026-10-21)에 따라 "PR 병합은 사용자만 수행" 정책을 "필수 CI 통과 시 에이전트가 merge commit으로 병합"으로 바꾼다.

## 변경

- `AGENTS.md` 구현 절차 5번, `README.md` 진행 순서, `docs/project-setup.md`(공통 원칙 2번, Git 전략 순서·병합, 파일 역할 표, AGENTS.md 템플릿 5번)의 병합 정책 문장.
- 스킬 원본 `skills/`의 implementation(YAML description, 도입문, 5절 전체), foundation(도입문, 수행 7번), testing(도입문, 실행 기준) 병합 문장. `npm run skills:sync`로 `.claude/skills/`를 갱신했다.
- 새 정책: 필수 CI 검사가 모두 통과하면 에이전트(주 에이전트·로컬 워커)가 프로젝트 래퍼로 `pr merge <url> --merge --match-head-commit <확인한 head SHA>`를 실행하고 연결 이슈 종료를 확인한다. 연속·스택 PR은 앞 PR 병합 후 `origin/main`을 병합해 충돌 해결 → 관련 테스트 재실행 → 일반 푸시 → CI 통과 → 병합 순서로 진행한다.
- 계속 금지: 실패·실행 중 검사가 있는 PR 병합, `--admin`·브랜치 보호 우회, 자기 PR 승인으로 검토 대체, `main` 직접 푸시, force push.
- 이 프로젝트는 `main` 병합이 자동 배포를 일으키지 않는다(CI는 검증·Docker 빌드만, 하위 저장소 동기화는 요청 시에만). 이를 implementation 스킬과 `AGENTS.md`에 적었다.
- `docs/project-setup.md`의 squash merge 추천은 merge commit 정책으로 바꿨다. 과거 기록(`docs/changes/bootstrap.md`)은 그대로 둔다.

## 검증

- `PYTHONUTF8=1 python quick_validate.py skills/<skill>` (skill-creator, 3개 스킬): 모두 `Skill is valid!`
- `npm run skills:check`: `.claude/skills matches skills/.`
- `npm run test:skills`: 4 pass / 0 fail / 0 skip
- `npx --no-install prettier --check AGENTS.md README.md docs skills .claude/skills`: 통과
- 이전 정책 문구 grep(`사용자 병합`, `사용자만 병합`, `merging to the user`, `gh pr merge` 등, `docs/changes` 제외): 남은 항목 없음
- 로컬 `npm run check` 전체(lint·타입·앱 테스트·빌드)는 실행하지 않았다. 이 체크아웃에 `node_modules`가 없고 패키지 설치는 사용자 재확인 대상이기 때문이다. 앱 코드 변경이 없는 문서·스킬 변경이며 전체 검사는 GitHub Actions CI로 확인한다.

## 2026-10-21 — PR 후 자동 리뷰(최대 2회)

### 목적

저장소 소유자가 병합 정책을 보완하도록 요청했다. PR을 올린 뒤 자동 코드 리뷰를 최대 2회(리뷰 → 보완 커밋 → 2차 리뷰 → 보완 커밋) 거친다. 이 PR에서 고치기에 큰 수정은 새 이슈카드로 분리하고, 그 뒤 최종 head의 필수 CI가 통과하면 병합한다. 리뷰에서 보완점이 없으면 바로 CI 확인과 병합으로 넘어간다.

### 변경

- `skills/dev-career-portfolio-implementation/SKILL.md`: "4. 테스트 후 PR 생성"과 병합 사이에 "5. PR 후 자동 코드 리뷰(최대 2회)"를 추가했다. 내용은 1·2차 리뷰, 보완 커밋, 3차 리뷰 없음, 큰 수정의 새 이슈 분리 기준, 병합 보류 조건, 차수별 기록, 최종 head 기준 CI 후 병합이다. 기존 병합 절은 "6. CI 통과 후 병합"으로 번호를 바꿨다. YAML description과 도입문도 리뷰 단계를 포함하도록 고쳤다.
- `AGENTS.md` 구현 절차 5번, `README.md` 진행 순서, `docs/project-setup.md`(공통 원칙 2번, Git 전략 순서, 리뷰 항목 신설, 파일 역할 표, AGENTS.md 템플릿 5번), foundation 스킬(도입문, 수행 7번), testing 스킬(도입문, 실행 기준)에 짧은 요약을 반영했다.
- 기존 안전 금지(실패·실행 중 검사 병합, `--admin`·보호 우회, 자기 PR 승인, `main` 직접 푸시, force push)와 연속·스택 PR 처리는 유지했다.
- `npm run skills:sync`로 `.claude/skills/`를 갱신했다. 과거 기록(`docs/changes/bootstrap.md`)은 수정하지 않았다.

### 검증

- `npm run skills:sync` 후 `npm run skills:check`: `.claude/skills matches skills/.`
- `npm run test:skills`: 4 pass / 0 fail / 0 skip
- `PYTHONUTF8=1 python quick_validate.py skills/<skill>` (codex skill-creator, implementation·foundation·testing 3개): 모두 `Skill is valid!`
- `npx --no-install prettier --check AGENTS.md README.md docs skills .claude/skills`: 통과
- lint·typecheck·앱 테스트·빌드(`npm run check` 전체)는 실행하지 않았다. 이 체크아웃에 `node_modules`가 없고 `AGENTS.md`가 패키지 설치를 사용자 재확인 대상으로 정하기 때문이다. 앱 코드 변경이 없는 문서·스킬 변경이며 전체 검사는 GitHub Actions CI로 확인한다.
