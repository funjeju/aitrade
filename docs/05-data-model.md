# 05. 데이터 모델 (Firestore)

## 5.1 컬렉션 개요

```
users/{uid}
  strategies/{strategyId}
    versions/{versionId}
      backtests/{backtestId}
scanMatches/{matchId}
alerts/{alertId}
trades/{tradeId}
adminAudit/{auditId}
locales/{lang}            (선택: 원격 i18n 메시지)
marketData/…             (별도 스토어 검토 — 5.6)
```

## 5.2 users

```jsonc
users/{uid} {
  email, displayName,
  role: "user" | "admin" | "superadmin",   // Firebase custom claims와 동기화
  locale: "ko" | "en",
  theme: "dark" | "light" | "system",
  priceColorMode: "kr" | "us",             // 상승=적/청 매핑 (03-design-system)
  plan: "free" | "pro",
  createdAt, updatedAt
}
```

## 5.3 strategies + versions (버전 관리)

전략은 **불변 버전(immutable version)** 모델. 수정 시 새 버전 생성, 과거 버전과 성과 보존.

```jsonc
strategies/{strategyId} {
  ownerUid, name, description,
  currentVersion: "v7",
  createdFrom: "chat" | "template",
  createdAt, updatedAt
}

strategies/{strategyId}/versions/{versionId} {
  version: "v7",
  parentVersion: "v6",          // 진화 추적
  dsl: { … },                   // 04-strategy-engine의 Strategy DSL(JSON)
  compiledRuleRef: "…",         // 컴파일된 규칙 위치(선택)
  changeSummary: "손절 폭 -3%→-2%, 거래량 기준 500%→400%",
  createdBy: uid, createdAt,
  latestBacktestId: "…"
}
```

## 5.4 backtests

```jsonc
versions/{versionId}/backtests/{backtestId} {
  period: { from, to },
  split: { method: "walk_forward", inSample: {…}, outOfSample: {…} },  // P2 필수
  metrics: {
    winRate, avgReturn, mdd, avgHoldingDays, tradeCount
  },
  outOfSampleMetrics: { … },     // 반드시 별도 기록
  assumptions: { fee, slippage, fillModel },
  reoptimizationCount: 3,        // 데이터 스누핑 추적
  universeHadDelisted: true,     // survivorship 처리 여부
  status: "queued" | "running" | "done" | "failed",
  createdAt
}
```

> UI는 항상 `outOfSampleMetrics`와 `split.method`를 함께 표시한다(과최적화·과장 방지, P2/P3).

## 5.5 scanMatches / alerts / trades

```jsonc
scanMatches/{matchId} {
  strategyVersionRef, symbol, scannedAt,
  signal: "BUY" | "WATCH" | "…",   // "당신 전략 조건 부합" 의미 (P1)
  matchScore: 0.92,
  context: { refCandleDate, pullbackPct, ma10Distance, … }  // 근거 스냅샷
}

alerts/{alertId}   { uid, matchRef, channel, sentAt, read }
trades/{tradeId}   { uid, symbol, side, qty, price, status, brokerRef, createdAt }
```

- `scanMatches.context`는 **차트에 근거를 시각화**하기 위한 스냅샷(Chart Preview 주석 소스).

## 5.6 시세/캔들 데이터 (분리 검토)

- 캔들 원본을 Firestore에 대량 저장하면 읽기 비용·문서수가 폭증. → **별도 스토어 검토**: 시계열 DB / 오브젝트 스토리지(파케이) / 벤더 API 직조회 캐시.
- Firestore에는 **파생·요약·상태(기준 캔들 등)**만, 원본 대량 시계열은 밖으로.
- 데이터 벤더/라이선스 미확정 → `02-architecture.md` "확인 필요".

## 5.7 보안 규칙 (Security Rules 원칙)

- 사용자는 **자기 문서만** 읽기/쓰기. `role` 필드·`custom claims`는 클라이언트가 못 바꾼다(서버/Function만).
- `admin` 권한 액션은 전부 `adminAudit`에 기록(불변 로그, `06-admin-i18n.md`).
- 전략 DSL 쓰기는 스키마 검증(Function) 통과분만.

## 5.8 인덱스
- `scanMatches`: `(strategyVersionRef, scannedAt desc)`, `(symbol, scannedAt desc)`.
- `strategies`: `(ownerUid, updatedAt desc)`.
- 복합 인덱스는 쿼리 확정 후 생성(과다 인덱스 비용 주의).
