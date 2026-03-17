"use client";

import { useState } from "react";
import { AnalysisResult } from "@/lib/types";
import ResultCard from "@/components/ResultCard";
import SellerMode from "@/components/SellerMode";

type BuyerTab = "link" | "search";
type Condition = "새상품" | "거의새것" | "사용감있음" | "많이사용";

const CONDITIONS: { value: Condition; label: string; emoji: string }[] = [
  { value: "새상품", label: "새상품", emoji: "✨" },
  { value: "거의새것", label: "거의새것", emoji: "👍" },
  { value: "사용감있음", label: "사용감있음", emoji: "👌" },
  { value: "많이사용", label: "많이사용", emoji: "🔧" },
];

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"buyer" | "seller">("buyer");

  // 링크 모드
  const [buyerTab, setBuyerTab] = useState<BuyerTab>("link");
  const [url, setUrl] = useState("");

  // 검색 모드
  const [searchQuery, setSearchQuery] = useState("");
  const [searchPrice, setSearchPrice] = useState("");
  const [searchCondition, setSearchCondition] = useState<Condition>("거의새것");

  const extractUrl = (text: string): string => {
    const match = text.match(/https?:\/\/[^\s"'<>]+/i);
    return match ? match[0] : text.trim();
  };

  const handleAnalyzeLink = async () => {
    if (!url.trim()) return;
    const cleanUrl = extractUrl(url);

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: cleanUrl }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "분석에 실패했습니다."); return; }
      setResult(data);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery.trim(),
          price: parseInt(searchPrice) || 0,
          condition: searchCondition,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "분석에 실패했습니다."); return; }
      setResult(data);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const resetResults = () => {
    setResult(null);
    setError("");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-orange">당근할까?</h1>
          <div className="flex bg-gray-100 rounded-full p-0.5 text-sm">
            <button
              onClick={() => { setMode("buyer"); resetResults(); }}
              className={`px-3 py-1.5 rounded-full transition-colors ${mode === "buyer" ? "bg-orange text-white" : "text-gray-500"}`}
            >
              구매자
            </button>
            <button
              onClick={() => { setMode("seller"); resetResults(); }}
              className={`px-3 py-1.5 rounded-full transition-colors ${mode === "seller" ? "bg-orange text-white" : "text-gray-500"}`}
            >
              판매자
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {mode === "buyer" ? (
          <>
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="text-sm text-gray-500 mb-3">
                이 매물, 살만한 가격인지 판별해드려요
              </p>

              {/* 링크 / 제품명 탭 */}
              <div className="flex bg-gray-100 rounded-lg p-0.5 mb-4 text-xs">
                <button
                  onClick={() => { setBuyerTab("link"); resetResults(); }}
                  className={`flex-1 py-2 rounded-md transition-colors font-medium ${buyerTab === "link" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"}`}
                >
                  링크로 검색
                </button>
                <button
                  onClick={() => { setBuyerTab("search"); resetResults(); }}
                  className={`flex-1 py-2 rounded-md transition-colors font-medium ${buyerTab === "search" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"}`}
                >
                  제품명으로 검색
                </button>
              </div>

              {buyerTab === "link" ? (
                <>
                  {/* 링크 모드 */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAnalyzeLink()}
                      placeholder="당근, 번개장터, 중고나라 등 링크 붙여넣기"
                      className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-orange focus:ring-1 focus:ring-orange"
                    />
                    <button
                      onClick={handleAnalyzeLink}
                      disabled={loading || !url.trim()}
                      className="px-5 py-3 bg-orange text-white rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-orange/90 transition-colors shrink-0"
                    >
                      {loading ? (
                        <span className="flex items-center gap-1.5">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          분석중
                        </span>
                      ) : "판별"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* 검색 모드 */}
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAnalyzeSearch()}
                    placeholder="제품명 (예: 에어팟 프로 2세대, 아이폰 15 프로)"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-orange focus:ring-1 focus:ring-orange mb-3"
                  />

                  <div className="flex gap-2 mb-3">
                    <div className="flex-1">
                      <label className="text-xs text-gray-400 mb-1 block">매물 가격</label>
                      <input
                        type="number"
                        value={searchPrice}
                        onChange={(e) => setSearchPrice(e.target.value)}
                        placeholder="가격 입력 (선택)"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-orange focus:ring-1 focus:ring-orange"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-400 mb-1 block">제품 상태</label>
                      <select
                        value={searchCondition}
                        onChange={(e) => setSearchCondition(e.target.value as Condition)}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-orange focus:ring-1 focus:ring-orange bg-white"
                      >
                        {CONDITIONS.map((c) => (
                          <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={handleAnalyzeSearch}
                    disabled={loading || !searchQuery.trim()}
                    className="w-full py-3 bg-orange text-white rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-orange/90 transition-colors"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        시세 조회중
                      </span>
                    ) : "시세 조회"}
                  </button>
                </>
              )}
            </div>

            {/* 링크 가이드 (링크 모드일 때만) */}
            {buyerTab === "link" && (
              <details className="mt-3 text-xs text-gray-400">
                <summary className="cursor-pointer hover:text-gray-500">
                  링크는 어떻게 복사하나요?
                </summary>
                <div className="mt-2 bg-white rounded-xl p-4 space-y-2 text-gray-500">
                  <p><span className="font-semibold text-gray-600">1.</span> 당근/번개장터/중고나라 등에서 매물 열기</p>
                  <p><span className="font-semibold text-gray-600">2.</span> <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 rounded text-[11px]">⋮</span> 메뉴 또는 <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 rounded text-[11px]">공유</span> 버튼 누르기</p>
                  <p><span className="font-semibold text-gray-600">3.</span> <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 rounded text-[11px]">링크 복사</span> 선택</p>
                  <p><span className="font-semibold text-gray-600">4.</span> 위 입력창에 붙여넣기 하면 끝!</p>
                  <p className="text-gray-400 pt-1">💡 공유 시 같이 복사되는 텍스트가 있어도 자동으로 링크만 추출해요</p>
                </div>
              </details>
            )}

            {error && (
              <div className="mt-4 bg-red-50 text-red border border-red-100 rounded-xl p-4 text-sm">
                {error}
              </div>
            )}

            {result && <ResultCard result={result} />}

            {!result && !loading && !error && (
              <div className="mt-8 text-center text-gray-400 text-sm">
                <div className="text-4xl mb-3">🥕</div>
                {buyerTab === "link" ? (
                  <>
                    <p>중고거래 앱에서 마음에 드는 매물을 발견하면</p>
                    <p>링크를 여기에 붙여넣어보세요!</p>
                  </>
                ) : (
                  <>
                    <p>궁금한 중고 제품의 시세를</p>
                    <p>바로 확인해보세요!</p>
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <SellerMode />
        )}
      </main>
    </div>
  );
}
