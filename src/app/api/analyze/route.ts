import { NextRequest, NextResponse } from "next/server";
import {
  scrapeDaangnProduct,
  searchDaangn,
  searchBunjang,
  searchDanawa,
} from "@/lib/scraper";
import { analyze } from "@/lib/analyzer";
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

// 제목에서 거래 노이즈만 최소한으로 제거. 제품명은 그대로 유지.
function cleanTitle(title: string): string {
  return title
    .replace(/[([{【〔][^\])}】〕]*[)\]}】〕]/g, "") // 괄호 안 부가정보
    .replace(/택배비?포함|직거래|네고\s*가능?|급처|무료배송|택포|팝니다|판매합니다|판매|떨이|급매/g, "")
    .replace(/\d+만\s*원?/g, "") // "5만원"
    .replace(/\d{4,}\s*원/g, "")  // "50000원"
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || !url.includes("daangn.com")) {
      return NextResponse.json(
        { error: "올바른 당근마켓 링크를 입력해주세요." },
        { status: 400 }
      );
    }

    // 1. 당근 상품 페이지 크롤링
    const product = await scrapeDaangnProduct(url);

    if (!product.title) {
      return NextResponse.json(
        { error: "상품 정보를 가져올 수 없습니다." },
        { status: 400 }
      );
    }

    // 2. 검색 키워드 = 제목에서 거래 노이즈만 제거 (제품명은 그대로)
    const searchQuery = cleanTitle(product.title);

    // 3. 모든 소스 동시 조회 — 새제품/중고 모두 같은 키워드
    const [naverItems, danawaItems, daangnListings, bunjangListings] =
      await Promise.all([
        searchNaver(searchQuery),
        searchDanawa(searchQuery),
        searchDaangn(searchQuery),
        searchBunjang(searchQuery),
      ]);

    // 4. 새제품 가격 합치기 (요금제/통신사 번들만 제거 + 중복 제거)
    const junkTitleWords = /요금제|할부|약정|통신사|SKT|KT|LGU|유플러스|알뜰폰|사은품|공시지원/i;
    const allNewItems = [...naverItems, ...danawaItems]
      .filter((item) => item.price >= 1000)
      .filter((item) => !junkTitleWords.test(item.title))
      .sort((a, b) => a.price - b.price);

    const seenPrices = new Set<number>();
    const deduped = allNewItems.filter((item) => {
      const bucket = Math.round(item.price / 1000);
      if (seenPrices.has(bucket)) return false;
      seenPrices.add(bucket);
      return true;
    });

    // 5. 중고 매물 합치기 (당근 + 번개장터) — 본인 글 제외
    const normalizeUrl = (u: string) => u.replace(/\/+$/, "").toLowerCase();
    const myUrl = normalizeUrl(url);
    const allUsedListings = [...daangnListings, ...bunjangListings].filter(
      (l) => normalizeUrl(l.url) !== myUrl
    );

    // 6. 분석
    const result = analyze(product, deduped, allUsedListings);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "분석 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
