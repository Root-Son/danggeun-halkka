"use client";

import { useState, useRef } from "react";

type Condition = "새상품" | "거의새것" | "사용감있음" | "많이사용";

interface SellerResult {
  suggested: number;
  range: { min: number; max: number };
  reasoning: string;
}

const QUICK_EXAMPLES = [
  { label: "아이폰", query: "아이폰 15 프로" },
  { label: "에어팟", query: "에어팟 프로 2세대" },
  { label: "맥북", query: "맥북 프로 14인치 M3" },
  { label: "아이패드", query: "아이패드 프로 11인치" },
  { label: "갤럭시", query: "갤럭시 S24 울트라" },
  { label: "닌텐도", query: "닌텐도 스위치 OLED" },
  { label: "다이슨", query: "다이슨 V15 디텍트" },
  { label: "PS5", query: "플레이스테이션5" },
];

export default function SellerMode() {
  const [query, setQuery] = useState("");
  const [condition, setCondition] = useState<Condition>("거의새것");
  const [loading, setLoading] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [result, setResult] = useState<SellerResult | null>(null);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [identifiedInfo, setIdentifiedInfo] = useState<{
    productName: string;
    category: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const conditions: { value: Condition; label: string; emoji: string }[] = [
    { value: "새상품", label: "새상품", emoji: "✨" },
    { value: "거의새것", label: "거의새것", emoji: "👍" },
    { value: "사용감있음", label: "사용감있음", emoji: "👌" },
    { value: "많이사용", label: "많이사용", emoji: "🔧" },
  ];

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/suggest-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), condition }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "조회에 실패했습니다.");
        return;
      }

      setResult(data);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 미리보기
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setIdentifying(true);
    setError("");
    setIdentifiedInfo(null);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/identify-product", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "제품 인식에 실패했습니다.");
        return;
      }

      setQuery(data.searchKeyword || data.productName);
      setIdentifiedInfo({
        productName: data.productName,
        category: data.category,
      });
    } catch {
      setError("제품 인식 중 오류가 발생했습니다.");
    } finally {
      setIdentifying(false);
    }
  };

  const clearImage = () => {
    setPreviewUrl(null);
    setIdentifiedInfo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div>
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <p className="text-sm text-gray-500 mb-3">
          제품 사진을 찍거나 제품명을 입력하면
          <br />
          적정 판매가를 알려드려요
        </p>

        {/* 사진 업로드 영역 */}
        <div className="mb-3">
          {previewUrl ? (
            <div className="relative">
              <img
                src={previewUrl}
                alt="업로드된 제품 사진"
                className="w-full h-40 object-cover rounded-xl"
              />
              {identifying && (
                <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                  <div className="text-white text-sm flex items-center gap-2">
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
                    제품 인식중...
                  </div>
                </div>
              )}
              <button
                onClick={clearImage}
                className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
              >
                X
              </button>
              {identifiedInfo && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 rounded-b-xl">
                  <p className="text-white text-sm font-semibold">
                    {identifiedInfo.productName}
                  </p>
                  <p className="text-white/70 text-xs">
                    {identifiedInfo.category}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-orange hover:bg-orange-light/30 transition-colors">
              <svg
                className="w-8 h-8 text-gray-300 mb-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
                />
              </svg>
              <span className="text-xs text-gray-400">
                사진으로 제품 자동 인식
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          )}
        </div>

        {/* 구분선 */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-xs text-gray-300">또는 직접 입력</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        {/* 빠른 선택 칩 */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {QUICK_EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              onClick={() => {
                setQuery(ex.query);
                setIdentifiedInfo(null);
              }}
              className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
                query === ex.query
                  ? "bg-orange text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {ex.label}
            </button>
          ))}
        </div>

        {/* 제품명 입력 */}
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIdentifiedInfo(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="브랜드 + 제품명 + 모델명 (예: 다이슨 V15 디텍트)"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-orange focus:ring-1 focus:ring-orange mb-1"
        />
        <p className="text-xs text-gray-300 mb-3 ml-1">
          구체적일수록 정확해요! 브랜드, 모델명, 세대/용량까지 입력해보세요
        </p>

        {/* 상태 선택 */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {conditions.map((c) => (
            <button
              key={c.value}
              onClick={() => setCondition(c.value)}
              className={`py-2 rounded-xl text-xs font-medium transition-colors ${
                condition === c.value
                  ? "bg-orange text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <span className="block text-base mb-0.5">{c.emoji}</span>
              {c.label}
            </button>
          ))}
        </div>

        <button
          onClick={handleSearch}
          disabled={loading || identifying || !query.trim()}
          className="w-full py-3 bg-orange text-white rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-orange/90 transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-1.5">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
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
              조회중
            </span>
          ) : (
            "적정가 조회"
          )}
        </button>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 text-red border border-red-100 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      {result && result.suggested > 0 && (
        <div className="mt-4 space-y-4">
          {/* 추천 가격 */}
          <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
            <p className="text-sm text-gray-500 mb-1">추천 판매가</p>
            <p className="text-3xl font-bold text-orange">
              {result.suggested.toLocaleString()}원
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {result.range.min.toLocaleString()}원 ~{" "}
              {result.range.max.toLocaleString()}원
            </p>
          </div>

          {/* 근거 */}
          <div className="bg-orange-light rounded-2xl p-4">
            <p className="text-xs font-semibold text-orange mb-1">산출 근거</p>
            <p className="text-sm text-gray-700">{result.reasoning}</p>
          </div>
        </div>
      )}

      {result && result.suggested === 0 && (
        <div className="mt-4 bg-yellow-50 border border-yellow-100 rounded-xl p-4 text-sm text-yellow-700">
          시세 정보가 부족합니다. 제품명을 더 구체적으로 입력해보세요.
        </div>
      )}

      {!result && !loading && !error && (
        <div className="mt-8 text-center text-gray-400 text-sm">
          <div className="text-4xl mb-3">💰</div>
          <p>사진 찍으면 AI가 제품을 알아서 인식하고</p>
          <p>적정 판매가를 알려드려요!</p>
        </div>
      )}
    </div>
  );
}
