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

function extractSearchKeyword(title: string): string {
  // 괄호 및 그 안의 부가 정보 제거
  let cleaned = title
    .replace(/[([{【〔][^\])}】〕]*[)\]}】〕]/g, "")
    .trim();

  // 흔한 노이즈 단어 제거
  const noiseWords = [
    "택배비포함", "직거래", "네고", "급처", "무료배송", "택포",
    "새상품", "미개봉", "풀박스", "풀박", "S급", "A급", "B급",
    "거의새것", "중고", "판매", "팝니다", "떨이", "급매",
    "정품", "리퍼", "공식", "국내", "해외", "수입",
    "충전기포함", "케이스포함", "박스포함", "영수증포함",
  ];
  const noiseRegex = new RegExp(noiseWords.join("|"), "g");
  cleaned = cleaned.replace(noiseRegex, "").trim();

  // 가격 패턴 제거 (예: "5만원", "50000원")
  cleaned = cleaned.replace(/\d+만\s*원?/g, "").replace(/\d{4,}\s*원/g, "").trim();

  // 연속 공백 정리
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  // 너무 긴 쿼리는 핵심 토큰만 추출 (앞 3~4단어)
  const tokens = cleaned.split(/\s+/);
  if (tokens.length > 4) {
    cleaned = tokens.slice(0, 4).join(" ");
  }

  return cleaned || title.slice(0, 20);
}

function extractNewProductKeyword(query: string): string {
  // 새제품 검색용: 부속품/규격/색상 키워드 제거 → 브랜드+모델만 남기기
  const partWords = [
    "충전케이스", "케이스", "본체", "이어폰", "이어버드",
    "충전기", "어댑터", "카바", "커버", "필름", "거치대",
    "8핀", "C타입", "USB", "라이트닝", "Lightning",
    "블랙", "화이트", "실버", "골드", "그레이", "블루", "레드", "핑크",
    "256GB", "512GB", "128GB", "64GB", "1TB",
    "좌측", "우측", "왼쪽", "오른쪽", "한쪽",
  ];
  const partRegex = new RegExp(partWords.join("|"), "gi");
  let cleaned = query.replace(partRegex, "").replace(/\s+/g, " ").trim();

  // 빈 결과면 원본 반환
  return cleaned || query;
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

    // 2. 검색 키워드 생성 (노이즈 제거 + 핵심 제품명 추출)
    const searchQuery = extractSearchKeyword(product.title);
    // 새제품 검색은 브랜드+모델만 (부속품/규격 제거)
    const newProductQuery = extractNewProductKeyword(searchQuery);

    // 3. 모든 소스 동시 조회 (네이버 + 다나와 + 당근 + 번개장터)
    const [naverItems, danawaItems, daangnListings, bunjangListings] =
      await Promise.all([
        searchNaver(newProductQuery),
        searchDanawa(newProductQuery),
        searchDaangn(searchQuery),
        searchBunjang(searchQuery),
      ]);

    // 4. 새제품 가격 합치기 (이상치 제거 + 중복 제거)
    const junkTitleWords = /요금제|할부|약정|통신사|SKT|KT|LGU|유플러스|알뜰폰|사은품|공시지원/i;
    // 핵심 키워드(브랜드/모델)가 제목에 포함된 것만
    const coreWords = newProductQuery.split(/\s+/).filter((w) => w.length >= 2);
    const allNewItems = [...naverItems, ...danawaItems]
      .filter((item) => item.price >= 1000) // 1,000원 미만 제거
      .filter((item) => !junkTitleWords.test(item.title)) // 요금제/통신사 상품 제거
      .filter((item) => {
        // 핵심 키워드 중 하나 이상 제목에 포함되어야 함
        if (coreWords.length === 0) return true;
        const titleLower = item.title.replace(/\s+/g, "").toLowerCase();
        return coreWords.some((w) => titleLower.includes(w.toLowerCase()));
      })
      .sort((a, b) => a.price - b.price);

    // 가격 이상치 제거: 중위값의 50% 미만인 항목 제거 (액세서리/미끼 상품)
    if (allNewItems.length >= 3) {
      const mid = allNewItems[Math.floor(allNewItems.length / 2)].price;
      const minThreshold = mid * 0.5;
      allNewItems.splice(
        0,
        allNewItems.length,
        ...allNewItems.filter((item) => item.price >= minThreshold)
      );
    }

    const seenPrices = new Set<number>();
    const deduped = allNewItems.filter((item) => {
      const bucket = Math.round(item.price / 1000);
      if (seenPrices.has(bucket)) return false;
      seenPrices.add(bucket);
      return true;
    });

    // 5. 중고 매물 합치기 (당근 + 번개장터)
    const allUsedListings = [...daangnListings, ...bunjangListings];

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
