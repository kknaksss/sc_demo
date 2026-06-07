# <Product Name> Work

최종 수정: YYYY-MM-DD

<PRODUCT>의 현재 구현, QA, 릴리즈 상태를 추적하는 map 입니다. 상세 WP 실행 본문은 `work/` 아래 1 파일 = 1 WP 로 둡니다.

외부 계약(SPEC)은 [spec-map.md](spec-map.md) 와 `spec/` 참조.

Status 값: `draft`, `in_dev`, `ready_for_qa`, `qa_blocked`, `ready_for_release`, `done`

## Status Board

| Phase | WP | Scope | Status | Owner | 예상 기간 | 목표 완료 | PR | QA | Blocker | 다음 |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | [<PRODUCT>-WP-001 <WP 제목>](work/work-01-<slug>.md) | <PRODUCT>-SPEC-001 | draft | TBD | TBD | TBD | - | not_ready | - | 첫 PR 생성 |

## WP List

| ID | 제목 | Status | Owner | 파일 | Covers SPEC |
|---|---|---|---|---|---|
| <PRODUCT>-WP-001 | <WP 제목> | draft | TBD | [work-01-<slug>.md](work/work-01-<slug>.md) | <PRODUCT>-SPEC-001 |

## Spec Coverage

각 SPEC 이 어느 WP 에서 구현되며 현재 진척이 어떤지 한눈에 보는 SPEC-centric view. covering WP 의 Status 를 종합한 derived view 입니다.

| Spec ID | Covering WP | 구현 상태 |
|---|---|---|
| <PRODUCT>-SPEC-001 | <PRODUCT>-WP-001 | draft |

## Release Gate - <Product Name> v1

### Scope

- [ ] 릴리즈 대상 Spec ID 가 정해졌다.
- [ ] 포함/제외 범위가 spec-map 의 Scope 와 맞다.

### Code

- [ ] 연결된 제품 PR 이 merge 됐다.

### Spec

- [ ] 필요한 spec-map / `spec/` 변경이 리뷰되고 merge 됐다.
- [ ] blocker open question 이 없다.

### QA

- [ ] 필요한 QA case 가 실행됐다.
- [ ] blocking fail 이 없다.
