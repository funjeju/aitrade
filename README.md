# ATS-OS — AI Trading Strategy OS

사용자가 자신의 매매 원칙을 **자연어로 설명 → AI가 정량화된 규칙(DSL)으로 변환 → 과거 데이터로 검증(백테스트) → 실시간 종목 탐색(스캐너)** 까지 연결하는 **전략 운영체제**.

> 핵심: "AI가 종목을 추천하는 서비스"가 아니라 **"사용자의 매매 철학을 실행 가능한 시스템으로 만들어 주는 도구"**. 판단의 주체는 항상 사용자다. (규제·설계 원칙은 [`CLAUDE.md`](CLAUDE.md) §1, `docs/` 참조.)

## 구현된 기능

| 영역 | 내용 |
|---|---|
| **AI 전략 대화** | 자연어 → Strategy DSL. 부족 조건을 되묻고, 각 파라미터의 계산식을 함께 제시(투명성). |
| **전략 관리** | 저장 · 불변 버전 진화(parent/변경요약) · 버전 이력 상세. |
| **정직한 백테스트** | out-of-sample 분리 + walk-forward 기본. look-ahead 방지 회귀 테스트. 성과에 기간·표본·검증방식 병기. |
| **스캐너** | 종목 유니버스 검색 → 내 전략 조건 부합 종목 탐색(BUY/WATCH + 근거). |
| **차트 근거** | 기준 캔들 · 매수/손절 구간 오버레이(지시 아님, 근거). |
| **관심종목** | 스캔 결과 저장 · 추적. |
| **키움 실데이터** | 일봉 조회 · 종목 리스트 (REST API). |
| **UX** | 다크/라이트 · ko/en · 등락색 모드(한국식/미국식). |

## 기술 스택

- **Frontend**: Next.js 15 (App Router) + TypeScript strict, Vercel 배포
- **Auth/DB**: Firebase Authentication + Firestore (클라이언트 SDK + 보안 규칙)
- **i18n**: next-intl (ko/en, N개 확장 가능)
- **AI**: OpenAI (자연어→DSL)
- **시세**: 키움증권 REST API (사용자 앱키 기반)
- **엔진**: `packages/strategy-engine` — 순수 함수 지표/백테스트/스캐너 (단위 테스트 32개)

## 저장소 구조

```
apps/web/                 Next.js 앱
  src/app/[locale]/       로케일 라우팅 (dashboard, ai-chat, strategies,
                          backtest, scanner, alerts, trades, marketplace, settings, admin)
  src/app/api/kiwoom/     키움 프록시 (token/candles/scan/universe/status)
  src/lib/                firebase · auth · kiwoom · strategy · scan · llm · prefs
packages/strategy-engine/ 지표·기준캔들·눌림·DSL·백테스트·스캐너·zones (+ tests)
packages/ui/              디자인 토큰(tokens.css) — 다크/라이트/등락색 단일 소스
firestore.rules           per-uid 소유·불변 버전 규칙
docs/                     제품/아키텍처/전략엔진/데이터모델/로드맵 스펙
```

## 로컬 실행

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # 값 채우기 (아래)
pnpm dev                                        # http://localhost:3000/ko
```

### 환경변수 (`apps/web/.env.local`)

```
# 키움 REST API (서버 전용) — 앱키만 있으면 시세/스캐너 동작
KIWOOM_ENV=real            # real=실전 / mock=모의 (키 종류와 일치해야 함)
KIWOOM_APP_KEY=
KIWOOM_APP_SECRET=

# OpenAI (AI 전략 대화)
OPENAI_API_KEY=
LLM_MODEL_GENERATE=gpt-5.4-mini

# Firebase (로그인·저장) — 없어도 앱은 렌더링됨
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

> 로그인/저장 기능을 쓰려면 Firebase 콘솔에서 **Authentication(이메일·익명) 활성화 + Firestore 생성 + `firestore.rules` 배포**가 필요하다.

## 검증

```bash
pnpm --filter @ats/strategy-engine test   # 엔진 단위 테스트 (32)
pnpm --filter @ats/web typecheck          # tsc --noEmit
pnpm --filter @ats/web lint               # ESLint
pnpm --filter @ats/web i18n:check         # ko/en 키 누락 검사
pnpm --filter @ats/web build              # 프로덕션 빌드
```

## 배포 (Vercel)

- **Root Directory** = `apps/web` (모노레포). "Include files outside root directory" 활성화.
- Environment Variables에 위 키들 등록 후 배포.

## 로드맵

- **Phase 1 (완료)** 전략 설계 + 정직한 백테스트
- **Phase 2 (핵심 완료)** 실시간 스캐너 + 근거 시각화
- **Phase 3 (규제 검토 후)** 반자동 → 자동 집행
- **Phase 4 (규제 재검토 후)** 마켓플레이스

상세: [`docs/07-roadmap.md`](docs/07-roadmap.md)

## 원칙 (요약)

1. **판단의 주체는 사용자** — 개별 종목 자문 아님. "당신 전략 조건에 부합하는 종목"으로 표현.
2. **과최적화는 사고** — out-of-sample/walk-forward 기본, 편향 구조적 차단.
3. **수익 단정·과장 금지** — 성과엔 기간·표본·검증방식 병기.
4. **감각의 정량화는 투명하게** — 모든 파라미터의 계산식 공개.

전체 원칙은 [`CLAUDE.md`](CLAUDE.md).
