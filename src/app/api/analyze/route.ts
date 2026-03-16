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

/** Gemini로 당근 글의 제목+본문을 읽고 정확한 제품 정보 추출 */
async function extractProductInfo(
  title: string,
  description: string
): Promise<{ newProductKeyword: string; usedSearchKeyword: string; condition: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { newProductKeyword: title, usedSearchKeyword: title, condition: "" };
  }

  const prompt = `당근마켓 중고거래 글을 분석해서 아래 JSON을 채워줘.

[글 정보]
제목: ${title}
본문: ${description.slice(0, 500)}

[규칙]
1. newProductKeyword: 이 **정확한 제품**의 새제품을 쇼핑몰에서 찾을 수 있는 공식 제품명. 제목의 약어나 줄임말을 정식 명칭으로 바꿔야 함.
   - "에어팟프로2 충전케이스 8핀" → "Apple 에어팟 프로 2세대 MagSafe 충전케이스 라이트닝"
   - "갤럭시 S24 울트라 256" → "삼성 갤럭시 S24 울트라 256GB"
   - "아이패드프로 4세대 11인치" → "Apple 아이패드 프로 4세대 11인치"
   - "다이슨 v15" → "다이슨 V15 디텍트"
2. usedSearchKeyword: 중고마켓에서 같은 제품을 찾을 키워드. 사람들이 실제로 검색하는 자연스러운 표현.
3. condition: 본문에서 파악한 상태. "사용감 있다", "기스", "찍힘", "오염" → 사용감있음. "거의 안 씀", "미개봉급" → 거의새것. "새제품", "미개봉" → 새상품. "많이 사용", "고장", "파손" → 많이사용. 판단 불가면 빈 문자열.

JSON만 출력:
{"newProductKeyword":"...","usedSearchKeyword":"...","condition":"..."}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 8192, temperature: 0.1 },
        }),
      }
    );

    if (!res.ok) {
      return { newProductKeyword: title, usedSearchKeyword: title, condition: "" };
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { newProductKeyword: title, usedSearchKeyword: title, condition: "" };

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      newProductKeyword: parsed.newProductKeyword || title,
      usedSearchKeyword: parsed.usedSearchKeyword || title,
      condition: parsed.condition || "",
    };
  } catch (e) {
    console.error("Gemini extract error:", e);
    return { newProductKeyword: title, usedSearchKeyword: title, condition: "" };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // 공유 텍스트에서 당근 URL 추출 ("이 글을 당근해보세요!\nhttps://..." 등)
    const urlMatch = (body.url || "").match(/https?:\/\/(?:www\.)?daangn\.com\/[^\s"'<>]+/i);
    const url = urlMatch ? urlMatch[0] : (body.url || "").trim();

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

    // 2. Gemini로 본문 분석 → 새제품/중고 각각 최적 키워드 + 상태 추출
    const productInfo = await extractProductInfo(
      product.title,
      product.description
    );

    // 3. 새제품은 정식 제품명으로, 중고는 자연스러운 키워드로 검색
    const [naverItems, danawaItems, daangnListings, bunjangListings] =
      await Promise.all([
        searchNaver(productInfo.newProductKeyword),
        searchDanawa(productInfo.newProductKeyword),
        searchDaangn(productInfo.usedSearchKeyword),
        searchBunjang(productInfo.usedSearchKeyword),
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

    // 6. 분석 (Gemini가 파악한 상태 정보도 전달)
    const result = analyze(product, deduped, allUsedListings);

    // Gemini 분석 결과 추가
    return NextResponse.json({
      ...result,
      searchKeyword: productInfo.usedSearchKeyword,
      newProductKeyword: productInfo.newProductKeyword,
      detectedCondition: productInfo.condition,
    });
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
