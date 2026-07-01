# CLAUDE.md — ATS-OS (AI Trading Strategy OS)

> 이 파일은 Claude Code가 이 저장소에서 작업할 때 **항상 먼저 읽는 최상위 컨텍스트**다.
> 상세 스펙은 `docs/`에 있고, 이 파일은 "무엇을/왜/어떻게(원칙)"만 정의한다.

---

## 0. 한 줄 정의

사용자가 자신의 매매 원칙을 **자연어로 설명 → AI가 정량화된 규칙(Rule)으로 변환 → 과거 데이터로 검증(Backtest) → 실시간 종목 탐색(Scanner) → (검증 후) 증권사 API 반자동/자동 집행**까지 연결하는 **전략 운영체제(Strategy Operating System)**.

핵심은 **"AI가 종목을 추천하는 서비스"가 아니라 "사용자의 매매 철학을 실행 가능한 시스템으로 만들어 주는 도구"**라는 것이다. 이 한 문장이 제품·법무·마케팅 전체를 관통한다.

---

## 1. 절대 원칙 (Non-Negotiables)

작업 중 아래 원칙과 충돌하는 요구가 있으면 **멈추고 사람에게 확인**한다. 임의로 위반하지 않는다.

### P1. 판단의 주체는 항상 사용자다 (규제 포지셔닝)
- 시스템은 **사용자가 정의한 조건을 정량화·검색·집행**할 뿐, **특정 개인에게 종목/시점을 골라주는 개별 자문을 하지 않는다.**
- UI 카피, AI 응답, 알림 문구에서 **"이 종목을 사라 / 지금이 매수 타이밍이다"** 같은 단정·지시형 표현을 쓰지 않는다. 대신 **"당신의 전략 조건에 부합하는 종목"**으로 표현한다.
- 자동매매는 **"AI가 알아서"가 아니라 "사용자가 정의한 조건 충족 시 주문만 집행"**하는 시스템트레이딩 형태로만 구현한다.
- 근거·배경은 `docs/01-product-spec.md`의 "규제·컴플라이언스 라인" 참조.

### P2. 과최적화(Overfitting)는 버그가 아니라 사고다
- 백테스트는 반드시 **out-of-sample 분리 + walk-forward**를 기본값으로 한다. In-sample 단일 수치만 보여주는 화면/기능은 만들지 않는다.
- **look-ahead bias, survivorship bias**를 구조적으로 차단한다 (`docs/04-strategy-engine.md`, `backtest-guard` 스킬 참조).
- "AI가 백테스트 보고 반복 개선"은 **무제한 재튜닝을 허용하지 않는다.** 재최적화 횟수·검증셋 오염을 추적하고 경고한다.

### P3. 수익률을 단정하거나 과장하지 않는다
- 화면·마케팅에서 **미실현 수익률을 실현 수익률처럼, 특정 유리한 기간만, 확실한 것처럼** 표시하지 않는다.
- 모든 성과 수치에는 **기간·표본수·검증 방식(in/out-of-sample)**을 함께 표기한다.

### P4. "감각의 정량화"는 투명해야 한다
- "눌림이 예쁘다" 같은 표현을 수치로 바꿀 때, **어떤 공식·파라미터로 계산했는지** 사용자가 항상 열어볼 수 있어야 한다. 블랙박스 금지.

> ⚠️ P1은 법률 자문이 아니라 제품 설계 가이드다. 실제 서비스 구조는 금융 전문 로펌 검토 / 금융위 비조치의견서 확인이 별도로 필요하다. 관련 미해결 사항은 `docs/01-product-spec.md`에 "확인 필요"로 표기되어 있다.

---

## 2. 기술 스택

| 레이어 | 선택 | 비고 |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript | Vercel 배포 |
| Hosting/Edge | **Vercel** | Preview 배포, Edge Functions, Cron |
| Auth | Firebase Authentication | 이메일/OAuth |
| DB | **Firestore** (+ 필요 시 시계열은 별도, `docs/05-data-model.md` 참조) | 전략/버전/유저 |
| Serverless | Firebase Cloud Functions / Vercel Route Handlers | 역할 분리는 아키텍처 문서 참조 |
| Realtime | Firestore 실시간 리스너 / 별도 스캐너 워커 | |
| i18n | `next-intl` | ko / en 우선, 확장 가능 |
| UI theming | CSS variables 기반 **다크/라이트 토큰** | `docs/03-design-system.md` |
| 시세/차트 데이터 | 증권사·데이터 벤더 API (미확정) | 라이선스·원가 이슈, "확인 필요" |

> Vercel + Firebase 조합의 책임 경계(무엇을 Vercel에, 무엇을 Firebase에)는 `docs/02-architecture.md`에 명시.

---

## 3. 저장소 구조 (현재 = 문서 단계)

지금은 **기획/문서 단계**라 폴더를 루트 + `docs/` 두 개로만 둔다.

```
00_aitrade/
├── CLAUDE.md                          ← 지금 이 파일
└── docs/
    ├── 01-product-spec.md ~ 07-roadmap.md   ← 상세 스펙 (4번 참조)
    ├── skill-strategy-dsl.md          ← 자연어→전략 규칙(DSL) 변환 규약
    ├── skill-backtest-guard.md        ← 백테스트 편향 방지 체크리스트
    ├── agent-strategy-architect.md    ← (참고) 전략 설계 역할 정의
    ├── agent-quant-engineer.md        ← (참고) 구현 역할 정의
    └── agent-design-system-guardian.md ← (참고) UI 가드 역할 정의
```

> `skill-*` / `agent-*`는 지금은 **참고 문서**다. 필요할 때 "backtest-guard 규칙대로 짜줘"처럼 직접 지목해서 쓴다.
>
> 나중에 Claude Code가 이 규칙들을 **자동 인식**하게 하려면, 코드 착수 시 아래처럼 옮기면 된다(그때 해도 됨):
> - `docs/skill-*.md` → `.claude/skills/<이름>/SKILL.md`
> - `docs/agent-*.md` → `.claude/agents/<이름>.md`

### 코드 착수 후 추가될 폴더 (예정)
```
├── apps/web/          ← Next.js 앱
├── packages/
│   ├── strategy-engine/  ← Rule Engine + 지표 정량화
│   └── ui/               ← 디자인 시스템 컴포넌트
└── functions/         ← Firebase Functions
```

---

## 4. 문서 지도 (docs/)

작업 전 관련 문서를 먼저 읽는다.

| 파일 | 언제 읽나 |
|---|---|
| `docs/01-product-spec.md` | 제품 범위·규제 라인·MVP 경계를 알아야 할 때 |
| `docs/02-architecture.md` | Vercel/Firebase 책임 분리, 데이터 흐름, 스캐너 구조 |
| `docs/03-design-system.md` | UI·다크/라이트 토큰·화면 구성·컴포넌트 |
| `docs/04-strategy-engine.md` | 기준 캔들·눌림목·지표 정량화 공식, Rule Engine, 백테스트 |
| `docs/05-data-model.md` | Firestore 컬렉션, 전략 버전관리 스키마 |
| `docs/06-admin-i18n.md` | 어드민 모드 권한/기능, 다국어(i18n) 구조 |
| `docs/07-roadmap.md` | 단계별 로드맵, MVP → 자동매매 순서 |
| `docs/skill-strategy-dsl.md` | 자연어→전략 규칙 변환 절차 (전략 대화 구현 시) |
| `docs/skill-backtest-guard.md` | 백테스트 편향 방지 체크리스트 (백테스트 작업 시) |
| `docs/agent-*.md` | 역할별 작업 규약(참고): 전략 설계 / 구현 / UI 가드 |

---

## 5. 서브에이전트 & 스킬 사용 규약

- **`strategy-architect`**: 사용자의 자연어 매매 설명을 받아 **부족한 조건을 되묻고** 전략 규칙 초안을 만든다. 실행 코드는 만들지 않는다. → 반드시 `strategy-dsl` 스킬을 따른다.
- **`quant-engineer`**: 전략 규칙을 실제 지표 계산/백테스트/스캐너 코드로 구현한다. → 백테스트 작성 시 **반드시 `backtest-guard` 스킬**을 통과시킨다.
- **`design-system-guardian`**: UI 변경 시 다크/라이트 토큰과 디자인 시스템을 강제한다. 하드코딩된 색상·인라인 스타일을 거부한다.

스킬은 "언제 어떤 순서로 무엇을 검증하는가"를 규정한다. 코드보다 절차가 우선이다.

---

## 6. 코딩 컨벤션 (요약)

- 언어: TypeScript strict. `any` 지양.
- 지표 계산 로직은 `packages/strategy-engine`에 **순수 함수**로 격리하고 단위 테스트를 붙인다. UI/DB에 섞지 않는다.
- 모든 금액·수익률·기간은 표시 단위와 계산 단위를 분리한다 (계산은 raw, 표시는 포매터).
- 시각적 요소는 **CSS 변수 토큰만** 사용. 색상 리터럴 금지 (`docs/03-design-system.md`).
- 사용자 노출 문자열은 전부 i18n 키를 통한다. 하드코딩된 한국어/영어 문자열 금지 (`docs/06-admin-i18n.md`).

---

## 7. Definition of Done

기능 하나를 "완료"라고 부르려면:
1. P1~P4 원칙 위반이 없다.
2. 지표/전략 로직에 단위 테스트가 있다.
3. 백테스트 관련이면 `backtest-guard` 체크리스트를 통과했다.
4. UI면 다크/라이트 양쪽에서 확인됐고 토큰만 사용했다.
5. 사용자 노출 문자열이 ko/en 모두 존재한다.
6. 성과 수치를 표시하면 기간·표본·검증방식이 함께 표기됐다.
