"use client";

import { useState, useRef } from "react";

type Condition = "새상품" | "거의새것" | "사용감있음" | "많이사용";

interface SellerResult {
  suggested: number;
  range: { min: number; max: number };
  reasoning: string;
  listing: {
    title: string;
    description: string;
  };
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
  const [copied, setCopied] = useState(false);
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
    setCopied(false);

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

    setIdentifying(true);
    setError("");

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
    } catch {
      setError("제품 인식 중 오류가 발생했습니다.");
    } finally {
      setIdentifying(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCopyListing = async () => {
    if (!result?.listing) return;
    const text = `${result.listing.title}\n\n${result.listing.description}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <p className="text-sm text-gray-500 mb-3">
          제품명과 상태를 입력하면<br />
          <strong className="text-gray-700">적정가 + 판매글</strong>을 한번에 만들어드려요
        </p>

        {/* 빠른 선택 칩 */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {QUICK_EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              onClick={() => setQuery(ex.query)}
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

        {/* 제품명 입력 + 사진 보조 버튼 */}
        <div className="flex gap-2 mb-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="브랜드 + 제품명 + 모델명"
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-orange focus:ring-1 focus:ring-orange"
          />
          <label className="px-3 py-3 rounded-xl border border-gray-200 text-gray-400 hover:border-orange hover:text-orange cursor-pointer transition-colors shrink-0 flex items-center">
            {identifying ? (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageUpload}
              className="hidden"
            />
          </label>
        </div>
        <p className="text-xs text-gray-300 mb-3 ml-1">
          모델명 모르겠으면 오른쪽 카메라로 사진 찍어보세요
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
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              적정가 조회 + 판매글 작성중...
            </span>
          ) : (
            "적정가 조회 + 판매글 작성"
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

          {/* 판매글 미리보기 */}
          {result.listing?.description && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 pt-4 pb-2 border-b border-gray-50">
                <p className="text-xs text-gray-400 mb-1">자동 작성된 판매글</p>
                <p className="font-semibold text-sm">{result.listing.title}</p>
                <p className="text-lg font-bold text-orange mt-0.5">
                  {result.suggested.toLocaleString()}원
                </p>
              </div>
              <div className="px-5 py-4">
                <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">
                  {result.listing.description}
                </p>
              </div>
              <div className="px-5 pb-4">
                <button
                  onClick={handleCopyListing}
                  className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors ${
                    copied
                      ? "bg-green text-white"
                      : "bg-orange text-white hover:bg-orange/90"
                  }`}
                >
                  {copied ? "복사 완료! 당근에 붙여넣기 하세요" : "판매글 복사하기"}
                </button>
              </div>
            </div>
          )}
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
          <p>제품명과 상태를 입력하면</p>
          <p>적정가 + 바로 올릴 수 있는 판매글을 만들어드려요!</p>
        </div>
      )}
    </div>
  );
}
