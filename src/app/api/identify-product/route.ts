import { NextRequest, NextResponse } from "next/server";

const PROMPT = `이 사진의 제품을 정확히 식별해주세요.

다음 형식으로만 답변해주세요 (JSON):
{
  "productName": "브랜드명 + 제품명 + 모델명/세대 (예: 애플 에어팟 프로 2세대, 다이슨 V15 디텍트, 닌텐도 스위치 OLED)",
  "category": "카테고리 (예: 이어폰, 청소기, 게임기)",
  "searchKeyword": "중고거래 검색에 최적화된 키워드 (예: 에어팟프로2, 다이슨v15, 스위치oled)"
}

JSON만 출력하고 다른 텍스트는 포함하지 마세요.`;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "AI 인식 기능이 설정되지 않았습니다. GEMINI_API_KEY를 설정해주세요." },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("image") as File;

    if (!file) {
      return NextResponse.json(
        { error: "이미지를 첨부해주세요." },
        { status: 400 }
      );
    }

    // 이미지를 base64로 변환
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    // Gemini API 호출
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: file.type,
                    data: base64,
                  },
                },
                { text: PROMPT },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: 300,
            temperature: 0.1,
          },
        }),
      }
    );

    if (!response.ok) {
      const errData = await response.json();
      console.error("Gemini API error:", errData);
      return NextResponse.json(
        { error: "제품 인식에 실패했습니다." },
        { status: 500 }
      );
    }

    const data = await response.json();
    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // JSON 파싱
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "제품을 인식하지 못했습니다. 다른 사진을 시도해보세요." },
        { status: 400 }
      );
    }

    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Identify product error:", error);
    return NextResponse.json(
      { error: "제품 인식 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
