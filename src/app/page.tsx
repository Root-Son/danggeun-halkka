"use client";

import { useState } from "react";
import { AnalysisResult } from "@/lib/types";
import ResultCard from "@/components/ResultCard";
import SellerMode from "@/components/SellerMode";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"buyer" | "seller">("buyer");

  // 붙여넣기한 텍스트에서 당근마켓 URL만 추출
  const extractDaangnUrl = (text: string): string => {
    const match = text.match(/https?:\/\/(?:www\.)?daangn\.com\/[^\s"'<>]+/i);
    return match ? match[0] : text.trim();
  };

  const handleAnalyze = async () => {
    if (!url.trim()) return;

    const cleanUrl = extractDaangnUrl(url);

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

      if (!res.ok) {
        setError(data.error || "분석에 실패했습니다.");
        return;
      }

      setResult(data);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-orange">당근할까?</h1>
          <div className="flex bg-gray-100 rounded-full p-0.5 text-sm">
            <button
              onClick={() => {
                setMode("buyer");
                setResult(null);
                setError("");
              }}
              className={`px-3 py-1.5 rounded-full transition-colors ${
                mode === "buyer"
                  ? "bg-orange text-white"
                  : "text-gray-500"
              }`}
            >
              구매자
            </button>
            <button
              onClick={() => {
                setMode("seller");
                setResult(null);
                setError("");
              }}
              className={`px-3 py-1.5 rounded-full transition-colors ${
                mode === "seller"
                  ? "bg-orange text-white"
                  : "text-gray-500"
              }`}
            >
              판매자
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {mode === "buyer" ? (
          <>
            {/* 구매자 모드: 링크 입력 */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="text-sm text-gray-500 mb-3">
                당근마켓에서 공유한 링크를 붙여넣으면<br />
                이 매물이 살만한지 판별해드려요
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                  placeholder="당근 링크 또는 공유 텍스트 붙여넣기"
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-orange focus:ring-1 focus:ring-orange"
                />
                <button
                  onClick={handleAnalyze}
                  disabled={loading || !url.trim()}
                  className="px-5 py-3 bg-orange text-white rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-orange/90 transition-colors shrink-0"
                >
                  {loading ? (
                    <span className="flex items-center gap-1.5">
                      <svg
                        className="animate-spin h-4 w-4"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      분석중
                    </span>
                  ) : (
                    "판별"
                  )}
                </button>
              </div>
            </div>

            {/* 링크 복사 가이드 */}
            <details className="mt-3 text-xs text-gray-400">
              <summary className="cursor-pointer hover:text-gray-500">
                링크는 어떻게 복사하나요?
              </summary>
              <div className="mt-2 bg-white rounded-xl p-4 space-y-2 text-gray-500">
                <p><span className="font-semibold text-gray-600">1.</span> 당근 앱에서 매물 열기</p>
                <p><span className="font-semibold text-gray-600">2.</span> 오른쪽 상단 <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 rounded text-[11px]">공유 ↗</span> 버튼 누르기</p>
                <p><span className="font-semibold text-gray-600">3.</span> <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 rounded text-[11px]">링크 복사</span> 또는 <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 rounded text-[11px]">클립보드에 복사</span> 선택</p>
                <p><span className="font-semibold text-gray-600">4.</span> 위 입력창에 붙여넣기 하면 끝!</p>
                <p className="text-gray-400 pt-1">💡 공유 시 같이 복사되는 텍스트가 있어도 자동으로 링크만 추출해요</p>
              </div>
            </details>

            {/* 에러 */}
            {error && (
              <div className="mt-4 bg-red-50 text-red border border-red-100 rounded-xl p-4 text-sm">
                {error}
              </div>
            )}

            {/* 결과 */}
            {result && <ResultCard result={result} />}

            {/* 빈 상태 안내 */}
            {!result && !loading && !error && (
              <div className="mt-8 text-center text-gray-400 text-sm">
                <div className="text-4xl mb-3">🥕</div>
                <p>당근마켓에서 마음에 드는 매물을 발견하면</p>
                <p>링크를 여기에 붙여넣어보세요!</p>
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
