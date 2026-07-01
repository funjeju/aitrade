# 03. 디자인 시스템 (Dark / Light)

레퍼런스: 첨부된 컨셉 시안(ATS-OS / TradeMind, "Neon Futuristic / Clean Modern / Minimal Light / Sleek Dark Professional"). 본 문서는 이를 **하나의 토큰 시스템으로 통합**해, 다크·라이트를 한 코드베이스에서 전환 가능하게 규정한다.

## 3.1 원칙

1. **색상 리터럴 금지.** 모든 색은 CSS 변수 토큰(`var(--...)`)으로만 쓴다.
2. **테마는 토큰 값 교체로만 바뀐다.** 컴포넌트 코드는 테마를 모른다.
3. 다크가 기본(트레이딩 툴 관행), 라이트는 완전 지원.
4. 시맨틱 토큰(역할) 위에서 작업한다. 원시 팔레트(raw palette)는 시맨틱 토큰 정의에서만 참조.

## 3.2 테마 전환 구조

```
:root              → 라이트 기본값 (시맨틱 토큰)
:root[data-theme="dark"] → 다크 오버라이드
```

- `next-themes`(또는 동등) + `data-theme` 속성. SSR 시 flash 방지(사전 스크립트로 초기 테마 주입).
- 사용자 선택은 Settings에 저장(Firestore) + 로컬 우선.

## 3.3 시맨틱 토큰 (역할 기반)

| 토큰 | 역할 | Light | Dark |
|---|---|---|---|
| `--bg-app` | 앱 배경 | `#F7F8FA` | `#0B0E14` |
| `--bg-surface` | 카드/패널 | `#FFFFFF` | `#141922` |
| `--bg-elevated` | 팝오버/모달 | `#FFFFFF` | `#1B222E` |
| `--border` | 경계선 | `#E5E8EC` | `#26303D` |
| `--text-primary` | 본문 | `#0B0E14` | `#E7ECF3` |
| `--text-secondary` | 보조 | `#5B6472` | `#9AA6B2` |
| `--text-muted` | 흐린 | `#8A94A3` | `#647082` |
| `--brand` | 브랜드/포커스 | `#3B82F6` | `#4C8DFF` |
| `--accent` | 강조(네온) | `#6366F1` | `#7C7CFF` |

### 시맨틱: 트레이딩 상태색 (한국 관습 준수)
> ⚠️ 한국 시장 관습은 **상승=적색, 하락=청색**으로 미국과 반대다. 색은 토큰으로 두고, **지역별로 매핑을 바꿀 수 있게** 설계한다 (i18n/locale과 연동, `06-admin-i18n.md`).

| 토큰 | 역할(KR 기본) |
|---|---|
| `--price-up` | 상승 = 적색 계열 `#E5484D` |
| `--price-down` | 하락 = 청색 계열 `#3B82F6` |
| `--signal-buy` | 매수 시그널 뱃지 (녹색 `#16A34A` / 다크 `#22C55E`) |
| `--signal-watch` | 관찰 뱃지 (앰버 `#D97706` / 다크 `#F59E0B`) |
| `--success` `--warning` `--danger` | 시스템 상태색 (가격색과 분리) |

> **가격 등락색과 시스템 상태색을 반드시 분리한다.** (한국에서 "상승=빨강"인데 danger도 빨강이면 혼동.)

### 차트 주석 토큰 (시안의 Chart Preview 반영)
| 토큰 | 의미 |
|---|---|
| `--chart-base-candle` | 기준 캔들 하이라이트 |
| `--chart-buy-zone-1` | 1차 매수구간 |
| `--chart-buy-zone-2` | 2차 매수구간 |
| `--chart-stop-zone` | 손절구간 |
| `--chart-trail-start` | 트레일링 시작선 |

## 3.4 타이포 / 스페이싱 / 반경

- 폰트: 라틴은 Inter 계열, 한글은 Pretendard 계열(가독성). 숫자는 **tabular-nums** 강제(표/시세 정렬).
- 스케일: `--text-xs/sm/base/lg/xl/2xl`. 대시보드 KPI 숫자는 `2xl~3xl`.
- 스페이싱: 4px 그리드. `--space-1..8`.
- 반경: `--radius-sm(6) / md(10) / lg(14)`. 카드는 `md`, 모달 `lg`.
- 그림자: 라이트=소프트 섀도, 다크=보더+미세 글로우(네온 컨셉 흡수, 과하지 않게).

## 3.5 레이아웃 (시안의 대시보드 기준)

```
┌────────────┬───────────────────────────────────────────────┐
│  Sidebar   │  Topbar: [검색] [알림] [테마토글] [언어] [유저]  │
│  (nav)     ├───────────────────────────────────────────────┤
│            │  KPI Row: 전략수 · 승률 · 평균수익 · MDD · 보유일 │
│  Dashboard │                                                 │
│  Strategies├──────────────────────┬────────────────────────┤
│  AI Chat   │  AI Strategy Chat     │  Strategy Performance   │
│  Backtest  │  (부족조건 질문형)     │  (누적수익 곡선)         │
│  Scanner   ├──────────────────────┼────────────────────────┤
│  Alerts    │  Live Scanner Results │  Chart Preview          │
│  Trades    │  (Symbol/Price/Chg%/  │  (기준캔들·매수·손절     │
│  Marketplace│  Volume/Match/Signal)│   ·트레일링 주석)        │
│  Admin     │                                                 │
│  Settings  │                                                 │
└────────────┴───────────────────────────────────────────────┘
```

### 핵심 컴포넌트 규격
- **KPI Card**: 라벨(secondary) + 값(primary, tabular-nums) + 델타(가격색 토큰). MDD 등 음수는 항상 부호·색 함께.
- **AI Strategy Chat**: 말풍선(유저=brand 배경, AI=surface). AI가 **부족 조건을 번호 목록으로 되묻는** 패턴을 컴포넌트로 지원.
- **Live Scanner Table**: 컬럼 = Symbol, Price, Chg%, Volume, Strategy Match(%), Signal. Signal은 `--signal-buy/watch` 뱃지. 정렬·필터 지원.
- **Chart Preview**: 캔들 + 주석 레이어(3.3 차트 토큰). 매수/손절/트레일 구간을 **근거로서** 오버레이 (P1: 지시가 아니라 "당신 전략의 구간 표시").

## 3.6 접근성
- 텍스트 대비 WCAG AA 이상. 가격 상승/하락을 **색만으로** 구분하지 않는다(부호·아이콘 병기) — 색각 이상 대응.
- 포커스 링 토큰(`--brand`) 항상 노출. 키보드 내비 지원.

## 3.7 구현 메모
- 토큰은 `packages/ui`의 `tokens.css`(라이트) + `[data-theme="dark"]` 블록으로 단일 소스.
- Tailwind 사용 시 색은 토큰 CSS 변수를 매핑해서만 노출(임의 팔레트 클래스 금지).
- 실제 컴포넌트 착수 시 `frontend-design` 스킬을 함께 참조(이 문서는 토큰·구조 규격, 스킬은 시각 완성도 가이드).
