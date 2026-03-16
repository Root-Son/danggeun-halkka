import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const notoSansKR = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "당근할까? - 당근마켓 시세 판별기",
  description:
    "당근마켓 중고 매물의 적정가를 판별해드립니다. 새제품 시세, 당근 거래 내역 기반 분석.",
  openGraph: {
    title: "당근할까? - 당근마켓 시세 판별기",
    description: "이 당근 매물, 살만할까? 링크만 붙여넣으면 바로 판별!",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${notoSansKR.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
