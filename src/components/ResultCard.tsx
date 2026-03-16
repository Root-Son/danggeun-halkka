"use client";

import { AnalysisResult } from "@/lib/types";

function formatPrice(price: number) {
  if (price === 0) return "-";
  return price.toLocaleString() + "원";
}

function SourceBadge({ source }: { source: string }) {
  const colors: Record<string, string> = {
    당근: "bg-orange/10 text-orange",
    번개장터: "bg-red-50 text-red",
  };
  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[source] || "bg-gray-100 text-gray-500"}`}
    >
      {source}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  if (confidence === "high") return null;
  const styles =
    confidence === "low"
      ? "bg-red-50 text-red-600"
      : "bg-yellow-50 text-yellow-700";
  const label = confidence === "low" ? "데이터 부족" : "참고용";
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ml-1.5 ${styles}`}>
      {label}
    </span>
  );
}

function VerdictBadge({ result }: { result: AnalysisResult }) {
  const bgColors: Record<string, string> = {
    great: "bg-green/10 border-green",
    good: "bg-blue-50 border-blue-400",
    fair: "bg-yellow-50 border-yellow",
    expensive: "bg-red-50 border-red",
  };

  const isLowConf = result.overallConfidence === "low";

  return (
    <div
      className={`text-center p-5 rounded-2xl border ${isLowConf ? "bg-gray-50 border-gray-200" : bgColors[result.verdict]}`}
    >
      <div className="text-3xl mb-1">{result.verdictLabel}</div>
      <p className="text-sm text-gray-600 mt-2">{result.summary}</p>
      {isLowConf && (
        <p className="text-xs text-gray-400 mt-2">
          더 정확한 분석을 위해 정확한 모델명이 포함된 매물을 검색해보세요
        </p>
      )}
    </div>
  );
}

export default function ResultCard({ result }: { result: AnalysisResult }) {
  return (
    <div className="mt-4 space-y-4">
      {/* 상품 요약 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <div className="flex gap-3">
          {result.product.images[0] && (
            <img
              src={result.product.images[0]}
              alt={result.product.title}
              className="w-20 h-20 rounded-xl object-cover"
            />
          )}
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-sm truncate">
              {result.product.title}
            </h2>
            <p className="text-lg font-bold text-orange mt-0.5">
              {formatPrice(result.product.price)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {result.product.location} · {result.product.status}
            </p>
          </div>
        </div>
      </div>

      {/* 판정 */}
      <VerdictBadge result={result} />

      {/* 가격 비교 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h3 className="font-semibold text-sm mb-3">가격 비교</h3>
        <div className="grid grid-cols-2 gap-3">
          {/* 중고 시세 */}
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-1">
              중고 시세
              <ConfidenceBadge confidence={result.marketPrice.confidence} />
            </p>
            {result.marketPrice.median > 0 ? (
              <>
                <p className="font-bold text-sm">
                  {formatPrice(result.marketPrice.median)}
                </p>
                {result.comparedToMarket < 0 ? (
                  <p className="text-xs text-green mt-0.5">
                    시세보다 {Math.abs(result.comparedToMarket)}% 저렴
                  </p>
                ) : result.comparedToMarket > 0 ? (
                  <p className="text-xs text-red mt-0.5">
                    시세보다 {result.comparedToMarket}% 비쌈
                  </p>
                ) : null}
                <p className="text-[10px] text-gray-300 mt-0.5">
                  {result.marketPrice.count}건 분석
                </p>
              </>
            ) : (
              <p className="text-xs text-gray-400 mt-1">
                시세를 파악하기 어려워요
              </p>
            )}
          </div>

          {/* 새제품 */}
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-1">
              새제품 최저가
              <ConfidenceBadge confidence={result.newPrice.confidence} />
            </p>
            {result.newPrice.lowest > 0 ? (
              <>
                <p className="font-bold text-sm">
                  {formatPrice(result.newPrice.lowest)}
                </p>
                {result.newPrice.warning ? (
                  <p className="text-xs text-yellow-600 mt-0.5">
                    {result.newPrice.warning}
                  </p>
                ) : result.discountFromNew > 0 ? (
                  <p className="text-xs text-green mt-0.5">
                    {result.discountFromNew}% 할인
                  </p>
                ) : result.discountFromNew < 0 ? (
                  <p className="text-xs text-red mt-0.5">
                    새제품보다 {Math.abs(result.discountFromNew)}% 비쌈
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-xs text-gray-400 mt-1">
                새제품 가격을 찾지 못했어요
              </p>
            )}
          </div>
        </div>

        {/* 시세 범위 바 */}
        {result.marketPrice.min > 0 && result.marketPrice.confidence !== "low" && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>{formatPrice(result.marketPrice.min)}</span>
              <span>{formatPrice(result.marketPrice.max)}</span>
            </div>
            <div className="relative h-2 bg-gray-100 rounded-full">
              <div className="absolute inset-0 bg-gray-200 rounded-full" />
              {result.marketPrice.max > result.marketPrice.min && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-orange rounded-full border-2 border-white shadow"
                  style={{
                    left: `${Math.min(
                      100,
                      Math.max(
                        0,
                        ((result.product.price - result.marketPrice.min) /
                          (result.marketPrice.max - result.marketPrice.min)) *
                          100
                      )
                    )}%`,
                  }}
                />
              )}
            </div>
            <p className="text-xs text-gray-400 text-center mt-1">
              🥕 = 이 매물 가격 (당근+번개장터 시세 범위)
            </p>
          </div>
        )}
      </div>

      {/* 최근 거래 내역 */}
      {result.marketPrice.recentSales.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold text-sm mb-3">최근 중고 거래 내역</h3>
          <div className="space-y-2">
            {result.marketPrice.recentSales.map((sale, i) => (
              <a
                key={i}
                href={sale.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex justify-between items-center p-2.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{sale.title}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                    <SourceBadge source={sale.source} />
                    {sale.location && <span>{sale.location}</span>}
                    <span className="text-gray-500">· 거래완료</span>
                  </p>
                </div>
                <p className="font-semibold text-sm ml-3 shrink-0">
                  {formatPrice(sale.price)}
                </p>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 네고 팁 */}
      {result.negoTip && (
        <div className="bg-orange-light rounded-2xl p-4">
          <p className="text-xs font-semibold text-orange mb-1">네고 가이드</p>
          <p className="text-sm text-gray-700">{result.negoTip}</p>
        </div>
      )}

      {/* 유사 매물 */}
      {result.marketPrice.listings.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold text-sm mb-3">
            중고 유사 매물 ({result.marketPrice.listings.length}건)
          </h3>
          <div className="space-y-2">
            {result.marketPrice.listings.map((listing, i) => (
              <a
                key={i}
                href={listing.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex justify-between items-center p-2.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{listing.title}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                    <SourceBadge source={listing.source} />
                    {listing.location && <span>{listing.location}</span>}
                    <span
                      className={
                        listing.status === "판매완료"
                          ? "text-gray-400"
                          : "text-green"
                      }
                    >
                      · {listing.status}
                    </span>
                  </p>
                </div>
                <p className="font-semibold text-sm ml-3 shrink-0">
                  {formatPrice(listing.price)}
                </p>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 새제품 참고 — 신뢰도 low면 경고와 함께 표시 */}
      {result.newPrice.items.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold text-sm mb-2">
            새제품 참고가
            <ConfidenceBadge confidence={result.newPrice.confidence} />
          </h3>
          {result.newPrice.confidence === "low" && (
            <p className="text-xs text-yellow-600 mb-3 bg-yellow-50 rounded-lg p-2">
              검색된 새제품이 이 매물과 다른 제품일 수 있어요. 참고만 해주세요.
            </p>
          )}
          <div className="space-y-2">
            {result.newPrice.items.slice(0, 3).map((item, i) => (
              <a
                key={i}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex justify-between items-center p-2.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{item.title}</p>
                  <p className="text-xs text-gray-400">{item.mall}</p>
                </div>
                <p className="font-semibold text-sm ml-3 shrink-0">
                  {formatPrice(item.price)}
                </p>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 데이터 출처 */}
      <p className="text-[10px] text-gray-300 text-center pb-2">
        네이버쇼핑 · 다나와 · 당근마켓 · 번개장터 데이터 기반
      </p>
    </div>
  );
}
