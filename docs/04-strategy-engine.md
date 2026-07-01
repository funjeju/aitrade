# 04. 전략 엔진 (Strategy Engine)

`packages/strategy-engine` — 지표 정량화 + Rule Engine + 백테스트의 **순수 로직**. UI/DB와 분리하고 단위 테스트로 고정한다.

## 4.1 설계 원칙

- 모든 지표는 **순수 함수**: `(candles, params) → number | boolean`.
- 전략은 데이터가 아니라 **DSL(선언적 규칙)**로 표현하고, 엔진이 이를 평가한다.
- **기준 캔들(Reference Candle)은 상태다.** 스캐너는 종목별로 기준 캔들을 기억하고 현재 위치를 비교한다.
- 파라미터는 전부 노출·조정 가능(P4 투명성). 매직넘버 하드코딩 금지.

## 4.2 정량화 사전 (감각 → 공식)

아래는 **기본 정의**이며, 파라미터는 전략별로 오버라이드된다.

### 장대양봉 / 기준 캔들 인식
문서 예시 정의를 기본값으로 채택:
- `시가 대비 고가 상승률 ≥ 20%` : `(high - open) / open ≥ 0.20`
- `종가가 고가 근처 마감 (≤5%)` : `(high - close) / high ≤ 0.05`
- `거래량 전일 대비 ≥ 500%` : `volume ≥ prevVolume * 5.0`
- `최근 20거래일 이내 발생`

세 조건을 모두 만족한 봉을 **기준 캔들**로 승격하고 다음을 기억한다:
`{ open, close, high, low, bodyMid = (open+close)/2, date, volume }`

### 눌림목(Pullback) 정량화 — 기준 캔들 이후
- **건강한 조정**: 상승 시 거래량↑, 조정 시 거래량↓ →
  `조정구간 평균거래량 / 기준캔들 이후 상승구간 평균거래량 ≤ pullbackVolRatio`
- **몸통 절반까지 눌림**: `현재가 ≈ bodyMid` (허용오차 `±εBodyMid`)
- **시가 부근까지 눌림**: `현재가 ≈ open` (허용오차 `±εOpen`)
- **10일선 근접도**: `abs(현재가 - MA10) / MA10 ≤ nearMaPct`

### 감각 지표
- **이평선 우상향(기울기)**: 최근 `slopeWindow`봉의 MA에 대한 선형회귀 계수 > `minSlope` (또는 각도 임계).
- **거래량 자연 감소**: `최근 k봉 평균거래량 / 직전 m봉 평균거래량 ≤ volDecayRatio`.
- **양봉 강도**: 몸통크기 `(close-open)/open`, 종가위치 `(close-low)/(high-low)`, 윗꼬리비율 `(high-max(open,close))/(high-low)`.

> 각 공식의 임계값은 전략 파라미터로 분리. **"정확 계산 vs 파라미터 의존"을 구분해 UI에 표시**(P4).

## 4.3 시장 → 섹터 → 대장주 (상단 파이프라인)

- **섹터 상승 초기 판정**: 장기 침체 종료 + 거래량 증가 + 상대강도 개선 + 이평 정배열 전환 + 기관/외국인 수급 변화의 **가중 스코어**.
- **대장주 선별**: 섹터 내에서 거래량 증가율·상대강도·수급·시총·유동성·상승탄력의 **랭킹**.
- ⚠️ **P1 준수**: 대장주는 "시스템이 추천"이 아니라 **"사용자가 정의/승인한 랭킹 기준의 계산 결과"**로 제시한다. 수급 데이터(기관/외국인)는 별도 데이터 소스 필요(확인 필요).

## 4.4 Strategy DSL (개요)

전략은 JSON DSL로 직렬화된다(스키마 상세는 `05-data-model.md`).

```jsonc
{
  "universe": { "market": "KR", "sectorFilter": { "state": "early_uptrend" } },
  "leader":   { "rankBy": ["relStrength","volSurge","supply"], "topN": 3 },
  "referenceCandle": {
    "highGainFromOpen": 0.20, "closeNearHighPct": 0.05,
    "volMultVsPrev": 5.0, "lookbackDays": 20
  },
  "entry": {
    "pullback": { "toBodyMid": { "tolerance": 0.02 }, "nearMA": { "period": 10, "pct": 0.03 } },
    "volumeHealth": { "decayRatio": 0.6 },
    "maSlope": { "period": 20, "minSlope": 0.0 },
    "splits": [ { "at": "bodyMid", "weight": 0.5 }, { "at": "open", "weight": 0.5 } ]
  },
  "exit": {
    "trailing": { "type": "atr", "mult": 2.0 },
    "maExit": { "period": 5 },
    "stop": { "basis": "refCandleLow", "buffer": 0.0 }
  }
}
```

- **entry.splits**: 분할 매수(몸통 절반 / 시가 부근 등).
- **exit**: 목표가 도달식이 아니라 **추세 추종**(트레일링/단기 이평 이탈). 손절은 기준 캔들 저점·변동성 기반의 명확한 자동 기준.

## 4.5 백테스트 (⚠️ CLAUDE.md P2 필수)

- **out-of-sample 분리 + walk-forward가 기본값.** in-sample 단독 수치만 노출하는 기능 금지.
- **look-ahead bias 차단**: 각 시점 판단에 미래 데이터 사용 금지(지표는 t 시점까지의 데이터로만).
- **survivorship bias 차단**: 상장폐지·거래정지 종목 포함된 유니버스 사용.
- **재최적화 추적**: 같은 검증셋에 대한 반복 튜닝 횟수를 기록·경고(데이터 스누핑 방지).
- 기록 지표: 승률, 평균수익률, MDD, 평균보유기간, 거래수, **+ 검증방식/기간/표본수 메타**.
- 수수료·슬리피지·체결 가정을 명시(비현실적 낙관 금지).

> 백테스트 코드를 작성/수정할 때는 반드시 `docs/skill-backtest-guard.md` 체크리스트를 통과시킨다.

## 4.6 테스트 전략
- 각 지표 함수: 알려진 입력→기대출력 단위 테스트.
- 기준 캔들 상태 추적: 시계열 시뮬레이션 테스트(과거 이벤트 기억→현재 비교).
- 백테스트 엔진: look-ahead 유입 시 실패하는 회귀 테스트(가드).
