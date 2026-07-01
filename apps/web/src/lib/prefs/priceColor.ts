/**
 * 등락색 모드(priceColorMode) — 로컬 우선(docs/06 §6.2).
 * kr = 상승 적/하락 청 (기본), us = 상승 녹/하락 적.
 * <html data-price="us"> 로 적용, 없으면 KR(기본).
 */
export type PriceColorMode = "kr" | "us";

export const PRICE_COLOR_KEY = "ats-price-color";

/** SSR flash 방지용 인라인 스크립트(문자열). layout <head>에서 즉시 실행. */
export const priceColorInitScript = `(function(){try{var m=localStorage.getItem('${PRICE_COLOR_KEY}');if(m==='us'){document.documentElement.setAttribute('data-price','us');}}catch(e){}})();`;

export function getPriceColor(): PriceColorMode {
  if (typeof document === "undefined") return "kr";
  return document.documentElement.getAttribute("data-price") === "us" ? "us" : "kr";
}

export function applyPriceColor(mode: PriceColorMode): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  if (mode === "us") el.setAttribute("data-price", "us");
  else el.removeAttribute("data-price");
  try {
    localStorage.setItem(PRICE_COLOR_KEY, mode);
  } catch {
    /* 저장 실패 무시 */
  }
}
