import { NextRequest, NextResponse } from "next/server";
import { searchDaangn, searchBunjang, searchDanawa } from "@/lib/scraper";
import { suggestSellingPrice } from "@/lib/analyzer";
import { NaverProduct } from "@/lib/types";

async function searchNaver(query: string): Promise<NaverProduct[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) return [];

  const res = await fetch(
    `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}&display=20&sort=sim`,
    {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
    }
  );

  if (!res.ok) return [];

  const data = await res.json();
  return (data.items || []).map(
    (item: { title: string; lprice: string; link: string; mallName: string; image: string }) => ({
      title: item.title.replace(/<[^>]*>/g, ""),
      price: parseInt(item.lprice) || 0,
      link: item.link,
      mall: item.mallName,
      image: item.image,
    })
  );
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
    const coreWords = query.split(/\s+/).filter((w: string) => w.length >= 2);
    const allNewItems = [...naverItems, ...danawaItems]
      .filter((item) => item.price >= 1000)
      .filter((item) => !junkTitleWords.test(item.title))
      .filter((item) => {
        if (coreWords.length === 0) return true;
        const titleLower = item.title.replace(/\s+/g, "").toLowerCase();
        return coreWords.some((w: string) => titleLower.includes(w.toLowerCase()));
      })
      .sort((a, b) => a.price - b.price);

    // 가격 이상치 제거
    if (allNewItems.length >= 3) {
      const mid = allNewItems[Math.floor(allNewItems.length / 2)].price;
      const minThreshold = mid * 0.5;
      allNewItems.splice(0, allNewItems.length, ...allNewItems.filter((item) => item.price >= minThreshold));
    }

    const allUsedListings = [...daangnListings, ...bunjangListings];

    const result = suggestSellingPrice(allNewItems, allUsedListings, condition);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Suggest price error:", error);
    return NextResponse.json(
      { error: "조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
