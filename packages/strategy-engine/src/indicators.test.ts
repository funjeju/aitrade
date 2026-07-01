import { describe, expect, it } from "vitest";
import {
  mean,
  sma,
  smaSeries,
  ema,
  linregSlope,
  volumeDecayRatio,
  bodySize,
  closePosition,
  upperWickRatio,
} from "./indicators";

describe("indicators", () => {
  it("mean", () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(Number.isNaN(mean([]))).toBe(true);
  });

  it("sma: 마지막 period 평균, 부족 시 null", () => {
    expect(sma([1, 2, 3, 4], 2)).toBe(3.5);
    expect(sma([1, 2], 3)).toBeNull();
  });

  it("smaSeries: 앞쪽 부족분 null", () => {
    expect(smaSeries([1, 2, 3], 2)).toEqual([null, 1.5, 2.5]);
  });

  it("ema: 상수열이면 그 값", () => {
    expect(ema([5, 5, 5, 5], 2)).toBeCloseTo(5, 10);
    expect(ema([1], 2)).toBeNull();
  });

  it("linregSlope: 순증가열은 양의 기울기", () => {
    expect(linregSlope([1, 2, 3, 4], 4)).toBeCloseTo(1, 10);
    expect(linregSlope([4, 3, 2, 1], 4)).toBeCloseTo(-1, 10);
    expect(linregSlope([1, 2], 5)).toBeNull();
  });

  it("volumeDecayRatio: 최근/직전 비율", () => {
    // 직전 2봉 평균=100, 최근 2봉 평균=50 → 0.5
    expect(volumeDecayRatio([100, 100, 50, 50], 2, 2)).toBe(0.5);
    expect(volumeDecayRatio([1, 2], 2, 2)).toBeNull();
  });

  it("양봉 강도 지표들", () => {
    expect(bodySize(100, 110)).toBeCloseTo(0.1, 10);
    expect(closePosition(110, 90, 108)).toBeCloseTo(0.9, 10);
    // high=110, low=90, close=open=100 → 윗꼬리=(110-100)/20=0.5
    expect(upperWickRatio(100, 110, 90, 100)).toBeCloseTo(0.5, 10);
  });
});
