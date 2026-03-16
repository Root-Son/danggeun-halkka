export interface DaangnProduct {
  title: string;
  price: number;
  description: string;
  category: string;
  status: string; // "판매중" | "예약중" | "판매완료"
  location: string;
  images: string[];
  chatCount: number;
  likeCount: number;
  viewCount: number;
  sellerName: string;
  sellerTemperature: number;
}

export interface NaverProduct {
  title: string;
  price: number;
  link: string;
  mall: string;
  image: string;
}

export interface UsedListing {
  title: string;
  price: number;
  status: string; // "판매중" | "판매완료" | "예약중"
  location: string;
  url: string;
  source: "당근" | "번개장터";
}

export type Verdict = "great" | "good" | "fair" | "expensive";

export interface RecentSale {
  title: string;
  price: number;
  location: string;
  url: string;
  source: "당근" | "번개장터";
}

export interface AnalysisResult {
  product: DaangnProduct;
  newPrice: {
    lowest: number;
    average: number;
    items: NaverProduct[];
  };
  marketPrice: {
    average: number;
    median: number;
    min: number;
    max: number;
    count: number;
    listings: UsedListing[];
    recentSales: RecentSale[];
  };
  verdict: Verdict;
  verdictLabel: string;
  discountFromNew: number;
  comparedToMarket: number;
  summary: string;
  negoTip: string;
}
