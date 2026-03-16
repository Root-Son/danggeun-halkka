import {
  DaangnProduct,
  NaverProduct,
  UsedListing,
  AnalysisResult,
  Verdict,
} from "./types";

function median(numbers: number[]): number {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function analyze(
  product: DaangnProduct,
  naverItems: NaverProduct[],
  usedListings: UsedListing[]
): AnalysisResult {
  // 새제품 가격 분석
  const naverPrices = naverItems.map((item) => item.price).filter((p) => p > 0);
  const newPriceLowest = naverPrices.length > 0 ? Math.min(...naverPrices) : 0;
  const newPriceAverage =
    naverPrices.length > 0
      ? Math.round(naverPrices.reduce((a, b) => a + b, 0) / naverPrices.length)
      : 0;

  // 중고 시세 분석 (당근 + 번개장터 통합)
  const soldListings = usedListings.filter(
    (l) => l.status === "판매완료" && l.price > 0
  );
  const recentSales = soldListings.slice(0, 5).map((l) => ({
    title: l.title,
    price: l.price,
    location: l.location,
    url: l.url,
    source: l.source,
  }));

  const allPricedListings = usedListings.filter((l) => l.price > 0);
  const marketListings =
    soldListings.length >= 3 ? soldListings : allPricedListings;
  const marketPrices = marketListings.map((l) => l.price);

  const marketAvg =
    marketPrices.length > 0
      ? Math.round(marketPrices.reduce((a, b) => a + b, 0) / marketPrices.length)
      : 0;
  const marketMedian = marketPrices.length > 0 ? median(marketPrices) : 0;
  const marketMin = marketPrices.length > 0 ? Math.min(...marketPrices) : 0;
  const marketMax = marketPrices.length > 0 ? Math.max(...marketPrices) : 0;

  // 새제품 대비 할인율
  const referenceNewPrice = newPriceLowest || newPriceAverage;
  const discountFromNew =
    referenceNewPrice > 0
      ? Math.round(((referenceNewPrice - product.price) / referenceNewPrice) * 100)
      : 0;

  // 중고 시세 대비 비교
  const referenceMarketPrice = marketMedian || marketAvg;
  const comparedToMarket =
    referenceMarketPrice > 0
      ? Math.round(((product.price - referenceMarketPrice) / referenceMarketPrice) * 100)
      : 0;

  // 판정 (중고 시세 대비 비중 높임)
  let verdict: Verdict;
  let verdictLabel: string;

  if (referenceMarketPrice > 0) {
    // 중고 시세가 있으면 시세 기반 판정 우선
    if (comparedToMarket <= -15) {
      verdict = "great";
      verdictLabel = "🟢 개이득!";
    } else if (comparedToMarket <= 0) {
      verdict = "good";
      verdictLabel = "🔵 괜찮은 가격";
    } else if (comparedToMarket <= 15) {
      verdict = "fair";
      verdictLabel = "🟡 애매해요";
    } else {
      verdict = "expensive";
      verdictLabel = "🔴 좀 비싸요";
    }
  } else if (referenceNewPrice > 0) {
    // 중고 시세 없으면 새제품 대비로 판정
    if (discountFromNew >= 50) {
      verdict = "great";
      verdictLabel = "🟢 개이득!";
    } else if (discountFromNew >= 30) {
      verdict = "good";
      verdictLabel = "🔵 괜찮은 가격";
    } else if (discountFromNew >= 15) {
      verdict = "fair";
      verdictLabel = "🟡 애매해요";
    } else {
      verdict = "expensive";
      verdictLabel = "🔴 좀 비싸요";
    }
  } else {
    verdict = "fair";
    verdictLabel = "🟡 판단 어려움";
  }

  // 요약 생성
  let summary = "";

  // 중고 시세 먼저 (핵심)
  if (referenceMarketPrice > 0) {
    const sourceCount = {
      당근: usedListings.filter((l) => l.source === "당근").length,
      번개장터: usedListings.filter((l) => l.source === "번개장터").length,
    };
    const sources = Object.entries(sourceCount)
      .filter(([, count]) => count > 0)
      .map(([name, count]) => `${name} ${count}건`)
      .join(", ");

    if (comparedToMarket < 0) {
      summary += `중고 시세(${referenceMarketPrice.toLocaleString()}원)보다 ${Math.abs(comparedToMarket)}% 저렴해요! `;
    } else if (comparedToMarket > 0) {
      summary += `중고 시세(${referenceMarketPrice.toLocaleString()}원)보다 ${comparedToMarket}% 비싸요. `;
    } else {
      summary += `중고 시세와 비슷한 가격이에요. `;
    }
    summary += `(${sources} 기반)`;
  } else {
    summary += `중고 거래 내역을 충분히 찾지 못해 시세 비교가 어렵습니다. `;
  }

  // 새제품 대비 (보조)
  if (referenceNewPrice > 0) {
    if (discountFromNew > 0) {
      summary += ` 새제품(${referenceNewPrice.toLocaleString()}원) 대비 ${discountFromNew}% 할인.`;
    } else if (discountFromNew < 0) {
      summary += ` 새제품(${referenceNewPrice.toLocaleString()}원)보다 ${Math.abs(discountFromNew)}%나 비쌈!`;
    }
  }

  // 네고 팁
  let negoTip = "";
  if (verdict === "expensive" && referenceMarketPrice > 0) {
    const suggestedPrice = Math.round(referenceMarketPrice * 0.95);
    negoTip = `${suggestedPrice.toLocaleString()}원 정도로 네고해보세요. 시세보다 살짝 아래가 적정선이에요.`;
  } else if (verdict === "fair" && referenceMarketPrice > 0) {
    const suggestedPrice = Math.round(referenceMarketPrice * 0.9);
    negoTip = `${suggestedPrice.toLocaleString()}원까지 네고 시도해볼 만해요.`;
  } else if (verdict === "good") {
    negoTip = "이미 괜찮은 가격이지만, 천원~만원 정도 네고는 시도해볼 수 있어요.";
  } else if (verdict === "great") {
    negoTip = "이 가격이면 네고 없이 바로 가도 좋아요!";
  }

  return {
    product,
    newPrice: {
      lowest: newPriceLowest,
      average: newPriceAverage,
      items: naverItems.slice(0, 5),
    },
    marketPrice: {
      average: marketAvg,
      median: marketMedian,
      min: marketMin,
      max: marketMax,
      count: marketPrices.length,
      listings: marketListings.slice(0, 10),
      recentSales,
    },
    verdict,
    verdictLabel,
    discountFromNew,
    comparedToMarket,
    summary,
    negoTip,
  };
}

/** 판매자용: 적정 판매가 추천 */
export function suggestSellingPrice(
  naverItems: NaverProduct[],
  usedListings: UsedListing[],
  condition: "새상품" | "거의새것" | "사용감있음" | "많이사용"
): {
  suggested: number;
  range: { min: number; max: number };
  reasoning: string;
} {
  const naverPrices = naverItems.map((i) => i.price).filter((p) => p > 0);
  const newPriceLowest = naverPrices.length > 0 ? Math.min(...naverPrices) : 0;

  const soldPrices = usedListings
    .filter((l) => l.status === "판매완료" && l.price > 0)
    .map((l) => l.price);

  const marketMedian = soldPrices.length > 0 ? median(soldPrices) : 0;

  const conditionRate: Record<string, number> = {
    새상품: 0.85,
    거의새것: 0.7,
    사용감있음: 0.55,
    많이사용: 0.4,
  };

  const rate = conditionRate[condition];

  // 중고 실거래가가 있으면 그걸 기준으로, 없으면 새제품 기준
  let basePrice: number;
  let basedOn: string;

  if (marketMedian > 0 && newPriceLowest > 0) {
    // 둘 다 있으면 중고 시세에 가중치를 더 줌
    basePrice = Math.round(marketMedian * 0.6 + newPriceLowest * rate * 0.4);
    basedOn = `중고 실거래가(${marketMedian.toLocaleString()}원)와 새제품 최저가(${newPriceLowest.toLocaleString()}원)를 종합`;
  } else if (marketMedian > 0) {
    basePrice = marketMedian;
    basedOn = `중고 실거래가 ${marketMedian.toLocaleString()}원 기준`;
  } else if (newPriceLowest > 0) {
    basePrice = Math.round(newPriceLowest * rate);
    basedOn = `새제품 최저가 ${newPriceLowest.toLocaleString()}원에 "${condition}" 감가율(${Math.round(rate * 100)}%) 적용`;
  } else {
    return {
      suggested: 0,
      range: { min: 0, max: 0 },
      reasoning: "시세 정보가 부족해서 추천이 어렵습니다.",
    };
  }

  const suggested = Math.round(basePrice / 1000) * 1000;
  const rangeMin = Math.round((suggested * 0.85) / 1000) * 1000;
  const rangeMax = Math.round((suggested * 1.15) / 1000) * 1000;

  let reasoning = `${basedOn}했어요. `;
  const sourceCount = usedListings.filter((l) => l.status === "판매완료").length;
  if (sourceCount > 0) {
    reasoning += `중고 거래 완료 ${sourceCount}건을 분석했습니다.`;
  }

  return { suggested, range: { min: rangeMin, max: rangeMax }, reasoning };
}
