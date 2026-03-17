import { DaangnProduct, UsedListing, NaverProduct } from "./types";

/** 어떤 중고거래 플랫폼이든 상품 정보를 추출 (JSON-LD + OG 메타태그 + HTML) */
export async function scrapeProduct(
  url: string
): Promise<DaangnProduct> {
  // 번개장터는 SPA라서 서버사이드 크롤링 불가
  if (url.includes("bunjang.co.kr")) {
    throw new Error("번개장터는 링크 분석이 어려워요. 제품명을 판매자 모드에서 직접 입력해주세요!");
  }

  // HTML에서 JSON-LD + OG 메타태그로 추출
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(`페이지를 불러올 수 없습니다 (${res.status})`);
  }

  const html = await res.text();

  const jsonLdMatch = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/
  );

  let title = "";
  let price = 0;
  let description = "";
  let images: string[] = [];

  if (jsonLdMatch) {
    try {
      const jsonLd = JSON.parse(jsonLdMatch[1]);
      title = jsonLd.name || "";
      price = parseInt(jsonLd.offers?.price) || 0;
      description = jsonLd.description || "";
      if (jsonLd.image) {
        images = Array.isArray(jsonLd.image) ? jsonLd.image : [jsonLd.image];
      }
    } catch {
      // fallback to HTML
    }
  }

  if (!title) {
    const m = html.match(/<meta property="og:title" content="([^"]*)">/);
    title = m?.[1] || "";
  }
  if (!description) {
    const m = html.match(/<meta property="og:description" content="([^"]*)">/);
    description = m?.[1] || "";
  }
  if (images.length === 0) {
    const m = html.match(/<meta property="og:image" content="([^"]*)">/);
    if (m) images = [m[1]];
  }
  if (!price) {
    const m = html.match(/(\d{1,3}(,\d{3})+)\s*원/);
    if (m) price = parseInt(m[1].replace(/,/g, ""));
  }

  const categoryMatch = html.match(/카테고리[^>]*>([^<]+)/);
  const category = categoryMatch?.[1]?.trim() || "";

  let status = "판매중";
  if (html.includes("판매완료") || html.includes("Closed")) status = "판매완료";
  else if (html.includes("예약중") || html.includes("Reserved")) status = "예약중";

  const locationMatch = html.match(/<meta[^>]*property="og:region"[^>]*content="([^"]*)"/);
  const viewMatch = html.match(/조회\s*(\d+)/);
  const likeMatch = html.match(/관심\s*(\d+)/);
  const chatMatch = html.match(/채팅\s*(\d+)/);
  const sellerMatch = html.match(/매너온도[^>]*?(\d+\.?\d*)/);
  const sellerNameMatch = html.match(/<meta[^>]*property="og:author"[^>]*content="([^"]*)"/);

  return {
    title,
    price,
    description,
    category,
    status,
    location: locationMatch?.[1] || "",
    images,
    chatCount: parseInt(chatMatch?.[1] || "0"),
    likeCount: parseInt(likeMatch?.[1] || "0"),
    viewCount: parseInt(viewMatch?.[1] || "0"),
    sellerName: sellerNameMatch?.[1] || "",
    sellerTemperature: parseFloat(sellerMatch?.[1] || "0"),
  };
}

// ─── 당근마켓 검색 ───

async function fetchDaangnSearch(query: string): Promise<{ title: string; price: string; status: string; href: string; regionId?: { name?: string } }[]> {
  const url = `https://www.daangn.com/kr/buy-sell/s/?search=${encodeURIComponent(query)}&_data=routes/kr.buy-sell.s`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  if (!res.ok) return [];
  try {
    const data = await res.json();
    return data?.allPage?.fleamarketArticles || [];
  } catch {
    return [];
  }
}

export async function searchDaangn(query: string): Promise<UsedListing[]> {
  // 결과 없으면 키워드를 줄여가며 재시도
  let articles = await fetchDaangnSearch(query);

  if (articles.length === 0) {
    const tokens = query.split(/\s+/);
    // 토큰이 3개 이상이면 앞 2개로 재시도
    if (tokens.length >= 3) {
      articles = await fetchDaangnSearch(tokens.slice(0, 2).join(" "));
    }
    // 그래도 없으면 첫 단어만
    if (articles.length === 0 && tokens.length >= 2) {
      articles = await fetchDaangnSearch(tokens[0]);
    }
  }

  try {

    return articles
      .filter((a: { title: string; price: string }) => a.title && parseFloat(a.price) > 0)
      .map((a: { title: string; price: string; status: string; href: string; regionId?: { name?: string } }) => {
        let status = "판매중";
        if (a.status === "Closed") status = "판매완료";
        else if (a.status === "Reserved") status = "예약중";

        return {
          title: a.title,
          price: Math.round(parseFloat(a.price)),
          status,
          location: a.regionId?.name || "",
          url: a.href || "",
          source: "당근" as const,
        };
      });
  } catch {
    return [];
  }
}

// ─── 번개장터 API ───

interface BunjangItem {
  pid: string;
  name: string;
  price: string;
  status: string;
  location: string;
  update_time: number;
  product_image: string;
  num_faved: number;
}

export async function searchBunjang(query: string): Promise<UsedListing[]> {
  const url = `https://api.bunjang.co.kr/api/1/find_v2.json?q=${encodeURIComponent(query)}&order=date&page=0&n=20`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!res.ok) return [];

  const data = await res.json();
  const items: BunjangItem[] = data.list || [];

  return items
    .filter((item) => parseInt(item.price) > 0)
    .map((item) => {
      // status: 0=판매중, 1=예약중, 2=판매완료
      let status = "판매중";
      if (item.status === "2" || item.status === "3") status = "판매완료";
      else if (item.status === "1") status = "예약중";

      return {
        title: item.name,
        price: parseInt(item.price),
        status,
        location: item.location || "",
        url: `https://m.bunjang.co.kr/products/${item.pid}`,
        source: "번개장터" as const,
      };
    });
}

// ─── 다나와 (새제품 시세) ───

export async function searchDanawa(query: string): Promise<NaverProduct[]> {
  const url = `https://search.danawa.com/dsearch.php?query=${encodeURIComponent(query)}&tab=goods`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!res.ok) return [];

  const html = await res.text();
  const results: NaverProduct[] = [];

  const productBlocks = html.split(/class="prod_item/g);

  for (let i = 1; i < productBlocks.length && results.length < 10; i++) {
    const block = productBlocks[i];

    const titleMatch = block.match(
      /class="prod_name"[^>]*>[\s\S]*?<a[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/
    );
    let title = titleMatch?.[1]?.replace(/<[^>]*>/g, "").trim() || "";

    if (!title) {
      const altTitleMatch = block.match(/alt="([^"]+)"/);
      title = altTitleMatch?.[1] || "";
    }

    const priceMatch = block.match(/class="price_sect"[\s\S]*?<em[^>]*>([\d,]+)<\/em>/);
    const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, "")) : 0;

    const mallMatch = block.match(/class="mall_name"[^>]*>([\s\S]*?)<\//);
    const mall = mallMatch?.[1]?.replace(/<[^>]*>/g, "").trim() || "다나와";

    const linkMatch = block.match(/href="(https?:\/\/[^"]+)"/);
    const link = linkMatch?.[1] || "";

    const imgMatch = block.match(/data-original="([^"]+)"|src="(https?:\/\/[^"]*img[^"]*)"/);
    const image = imgMatch?.[1] || imgMatch?.[2] || "";

    if (title && price > 0) {
      results.push({ title, price, link, mall, image });
    }
  }

  return results;
}
