import { NextRequest, NextResponse } from "next/server";
import { searchDaangn, searchBunjang, searchDanawa } from "@/lib/scraper";
import { suggestSellingPrice } from "@/lib/analyzer";
import { NaverProduct } from "@/lib/types";

async function searchNaver(query: string): Promise<NaverProduct[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) return [];

  const res = await fetch(
    `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}&display=40&sort=sim`,
    {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
    }
  );

  if (!res.ok) return [];

  const data = await res.json();
  const allItems = (data.items || []).map(
    (item: { title: string; lprice: string; link: string; mallName: string; image: string; productType: string }) => ({
      title: item.title.replace(/<[^>]*>/g, ""),
      price: parseInt(item.lprice) || 0,
      link: item.link,
      mall: item.mallName,
      image: item.image,
      _productType: item.productType,
    })
  );

  const priceCompare = allItems.filter((i: { _productType: string }) => i._productType === "1");
  const normalSeller = allItems.filter((i: { _productType: string }) => i._productType === "2");
  const selected = priceCompare.length > 0 ? priceCompare : normalSeller.length > 0 ? normalSeller : allItems;

  return selected.map(({ _productType, ...rest }: { _productType: string; title: string; price: number; link: string; mall: string; image: string }) => rest);
}

async function generateListing(
  query: string,
  condition: string,
  suggestedPrice: number,
  newPriceLowest: number,
  marketMedian: number
): Promise<{ title: string; description: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || suggestedPrice === 0) {
    return { title: query, description: "" };
  }

  const priceInfo = [];
  if (newPriceLowest > 0) priceInfo.push(`새제품 최저가 ${newPriceLowest.toLocaleString()}원`);
  if (marketMedian > 0) priceInfo.push(`중고 시세 ${marketMedian.toLocaleString()}원`);

  const prompt = `당근마켓에 올릴 판매글을 작성해줘. 실제 당근에서 잘 팔리는 글 스타일로.

제품: ${query}
상태: ${condition}
판매가: ${suggestedPrice.toLocaleString()}원
${priceInfo.length > 0 ? `참고: ${priceInfo.join(", ")}` : ""}

[규칙]
1. title: 당근마켓 제목 (40자 이내). 검색에 잘 걸리도록 브랜드+모델명+핵심스펙 포함. 예: "에어팟 프로 2세대 USB-C 풀박스"
2. description: 본문 (5~8줄). 아래 구성으로:
   - 제품 상태 간단히 (솔직하게)
   - 구성품 (본체, 박스, 충전케이블 등)
   - 새제품 가격 대비 얼마나 저렴한지 한 줄
   - 거래 방법 (직거래 선호, 택배 가능 등)
   - 해시태그 2~3개
   자연스럽고 친근한 말투. 과장 없이. 이모지 1~2개만.

JSON만 출력:
{"title":"...","description":"..."}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 8192, temperature: 0.7 },
        }),
      }
    );

    if (!res.ok) return { title: query, description: "" };

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { title: query, description: "" };

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      title: parsed.title || query,
      description: parsed.description || "",
    };
  } catch {
    return { title: query, description: "" };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { query, condition } = await req.json();

    if (!query) {
      return NextResponse.json(
        { error: "제품명을 입력해주세요." },
        { status: 400 }
      );
    }

    const validConditions = ["새상품", "거의새것", "사용감있음", "많이사용"];
    if (!validConditions.includes(condition)) {
      return NextResponse.json(
        { error: "올바른 상태를 선택해주세요." },
        { status: 400 }
      );
    }

    // 모든 소스 동시 조회
    const [naverItems, danawaItems, daangnListings, bunjangListings] =
      await Promise.all([
        searchNaver(query),
        searchDanawa(query),
        searchDaangn(query),
        searchBunjang(query),
      ]);

    const junkTitleWords = /요금제|할부|약정|통신사|SKT|KT|LGU|유플러스|알뜰폰|사은품|공시지원/i;
    const allNewItems = [...naverItems, ...danawaItems]
      .filter((item) => item.price >= 1000)
      .filter((item) => !junkTitleWords.test(item.title))
      .sort((a, b) => a.price - b.price);

    const allUsedListings = [...daangnListings, ...bunjangListings];

    const priceResult = suggestSellingPrice(allNewItems, allUsedListings, condition);

    // 가격이 산출되면 판매글 생성
    const newPriceLowest = allNewItems.length > 0 ? allNewItems[0].price : 0;
    const soldPrices = allUsedListings
      .filter((l) => l.status === "판매완료" && l.price > 0)
      .map((l) => l.price);
    const marketMedian = soldPrices.length > 0
      ? soldPrices.sort((a, b) => a - b)[Math.floor(soldPrices.length / 2)]
      : 0;

    const listing = await generateListing(
      query,
      condition,
      priceResult.suggested,
      newPriceLowest,
      marketMedian
    );

    return NextResponse.json({
      ...priceResult,
      listing,
    });
  } catch (error) {
    console.error("Suggest price error:", error);
    return NextResponse.json(
      { error: "조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
