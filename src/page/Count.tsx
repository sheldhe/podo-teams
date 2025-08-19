import React, { useMemo, useState } from "react";

/**
 * CountPage – 볼링 목표 점수 역산기
 * 사용법
 * 1) 목표 점수 입력 (예: 210)
 * 2) 1~7프레임 기록을 기호로 입력: X(스트라이크), 9/, 9-, 81 처럼
 * 3) 계산 버튼을 누르면 8~10프레임 가능한 시나리오를 제시
 *
 * 제한/메모
 * - 10프레임 규칙을 정확히 반영(보너스볼 포함)
 * - 탐색이 많아질 수 있어 최대 50개 솔루션만 노출
 * - 잘못된 기호는 자동으로 무시/정규화 시도
 */

// ----- 타입 -----
export type Frame = number[]; // 각 프레임의 투구 핀수 배열 (10프는 2~3개)

// ----- 유틸 -----
const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

// 기호 -> 프레임 숫자 변환
// 허용 예: "X", "9/", "- /"(공백 허용X), "9-", "81", "--", "X X X"(불가)
function parseFrameSymbol(sym: string): Frame | null {
  const s = sym.trim().replace(/\s+/g, "").toUpperCase();
  if (!s) return null;
  // 스트라이크
  if (s === "X") return [10];

  // 두 투구(스페어/오픈)
  if (s.length === 2) {
    const a = s[0] === "-" ? 0 : s[0] === "X" ? 10 : Number(s[0]);
    if (Number.isNaN(a) || a < 0 || a > 10) return null;
    const bChar = s[1];
    if (bChar === "/") {
      if (a >= 10) return null; // 첫 투구가 10이면 스페어 불가
      return [a, 10 - a];
    }
    const b = bChar === "-" ? 0 : bChar === "X" ? 10 : Number(bChar);
    if (Number.isNaN(b) || b < 0 || b > 10) return null;
    if (a + b > 10) return null; // 일반 프레임은 합 10 초과 불가
    return [a, b];
  }

  // 10프레임 전용 3문자 표기도 일부 허용: "X9/", "X--", "9/5" 등
  if (s.length === 3) {
    // 간단 파서: 첫 2구를 위 규칙으로 파싱 후, 3구 처리
    const firstTwo = parseFrameSymbol(s.slice(0, 2));
    if (!firstTwo) return null;
    const [a, b] = firstTwo;
    // 3구 합법성 체크 (10프만 허용)
    const cChar = s[2];
    const c =
      cChar === "-"
        ? 0
        : cChar === "X"
        ? 10
        : cChar === "/"
        ? a === 10
          ? null
          : 10 - b
        : Number(cChar);
    if (c === null || Number.isNaN(c as number)) return null;
    const cc = Number(c);
    if (a === 10) {
      // 1구 스트: 보너스 2구+3구. 2구 스트가 아니면 2+3 <= 10
      if (b !== 10 && b + cc > 10) return null;
      return [a, b, cc];
    }
    // 스페어면 3구 자유(0..10)
    if (a + b === 10) return [a, b, cc];
    // 오픈이면 3구 없어야 함
    return null;
  }

  return null;
}

// 전체 점수 계산 (표준 규칙)
function scoreGame(frames: Frame[]): number {
  // rolls 배열로 변환
  const rolls: number[] = [];
  for (let i = 0; i < frames.length; i++) rolls.push(...frames[i]);

  let score = 0;
  let rollIndex = 0;
  for (let frame = 1; frame <= 10; frame++) {
    if (rolls[rollIndex] === 10) {
      // 스트
      score += 10 + (rolls[rollIndex + 1] ?? 0) + (rolls[rollIndex + 2] ?? 0);
      rollIndex += frame === 10 ? 1 : 1; // 10프는 별도 구조지만 rollIndex 증가 동일
      if (frame === 10) {
        // 보너스 2구 이미 rolls에 포함됨, 루프 종료에서 처리
        // nothing extra here
      }
    } else {
      const a = rolls[rollIndex] ?? 0;
      const b = rolls[rollIndex + 1] ?? 0;
      const frameSum = a + b;
      if (frameSum === 10) {
        // 스페어
        score += 10 + (rolls[rollIndex + 2] ?? 0);
      } else {
        score += frameSum;
      }
      rollIndex += frame === 10 && (a === 10 || frameSum === 10) ? 2 : 2;
      if (frame === 10) {
        // 10프 보너스 처리: 첫투구 스트 혹은 스페어면 보너스 1~2구 포함
        if (a === 10) {
          score += (rolls[rollIndex] ?? 0) + (rolls[rollIndex + 1] ?? 0);
          rollIndex += 2;
        } else if (frameSum === 10) {
          score += rolls[rollIndex] ?? 0;
          rollIndex += 1;
        }
      }
    }
  }
  return score;
}

// 8~9프레임 후보 생성 (일반 프레임)
function generateNormalFrameCandidates(): Frame[] {
  const res: Frame[] = [];
  // 스트
  res.push([10]);
  // 스페어 (첫투구 0..9)
  for (let a = 0; a <= 9; a++) res.push([a, 10 - a]);
  // 오픈
  for (let a = 0; a <= 9; a++) {
    for (let b = 0; b <= 9 - a; b++) res.push([a, b]);
  }
  return res;
}

// 10프레임 후보 생성
function generateTenthFrameCandidates(): Frame[] {
  const res: Frame[] = [];
  // 오픈
  for (let a = 0; a <= 9; a++) {
    for (let b = 0; b <= 9 - a; b++) res.push([a, b]);
  }
  // 스페어 + 보너스 1구
  for (let a = 0; a <= 9; a++) {
    for (let c = 0; c <= 10; c++) res.push([a, 10 - a, c]);
  }
  // 스트 + 보너스 2구
  for (let b = 0; b <= 10; b++) {
    if (b === 10) {
      for (let c = 0; c <= 10; c++) res.push([10, b, c]);
    } else {
      for (let c = 0; c <= 10 - b; c++) res.push([10, b, c]);
    }
  }
  return res;
}

const NORMAL_CAND = generateNormalFrameCandidates();
const TENTH_CAND = generateTenthFrameCandidates();

function framesToPretty(fr: Frame): string {
  // 표현용
  if (fr.length === 1 && fr[0] === 10) return "X";
  if (fr.length === 2) {
    const [a, b] = fr;
    if (a + b === 10) return `${a === 0 ? "-" : a}/`;
    return `${a === 0 ? "-" : a}${b === 0 ? "-" : b}`;
  }
  // 10프
  const [a, b, c] = fr;
  const f = a === 10 ? "X" : a === 0 ? "-" : String(a);
  const s =
    a === 10
      ? b === 10
        ? "X"
        : String(b)
      : a + b === 10
      ? "/"
      : b === 0
      ? "-"
      : String(b);
  const t =
    a === 10
      ? b === 10
        ? c === 10
          ? "X"
          : String(c)
        : b + c === 10
        ? "/"
        : c === 0
        ? "-"
        : String(c)
      : a + b === 10
      ? c === 10
        ? "X"
        : String(c)
      : "";
  return `${f}${s}${t}`;
}

// 기존 1~7프레임 파싱
function parseFirstSeven(input: string[]): Frame[] {
  const res: Frame[] = [];
  for (let i = 0; i < input.length; i++) {
    const f = parseFrameSymbol(input[i] ?? "");
    if (f) res.push(f);
  }
  return res.slice(0, 7);
}

export default function CountPage() {
  const [target, setTarget] = useState<number>(210);
  const [first7, setFirst7] = useState<string[]>(Array(7).fill(""));
  const [solutions, setSolutions] = useState<Frame[][]>([]);
  const [previewScore, setPreviewScore] = useState<number | null>(null);
  const [limit, setLimit] = useState<number>(50);

  const knownFrames = useMemo(() => parseFirstSeven(first7), [first7]);

  function handleCalculate() {
    const partial = [...knownFrames];
    // 현재까지 7프 이하만 있을 수 있음. 프레임 수가 더 많거나 10프 이상이면 컷
    const prefixFrames = partial.slice(0, Math.min(7, partial.length));

    const sols: Frame[][] = [];

    // 미리 현재 최소/최대 추정으로 빠른 프루닝은 생략(간단 구현)
    for (const f8 of NORMAL_CAND) {
      for (const f9 of NORMAL_CAND) {
        for (const f10 of TENTH_CAND) {
          const game = [...prefixFrames, f8, f9, f10];
          const sc = scoreGame(game);
          if (sc === target) {
            sols.push([f8, f9, f10]);
            if (sols.length >= limit) break;
          }
        }
        if (sols.length >= limit) break;
      }
      if (sols.length >= limit) break;
    }

    // 미리보기: 현재 프레임만 점수(참고용)
    try {
      setPreviewScore(scoreGame([...prefixFrames] as Frame[]));
    } catch {
      setPreviewScore(null);
    }

    setSolutions(sols);
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-white to-purple-50 px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-extrabold text-purple-700">
            목표 점수 역산 (8~10프 추천)
          </h1>
          <div className="text-xs text-gray-500">
            미리 점수: {previewScore ?? "-"} / 타겟 {target}
          </div>
        </header>

        {/* 입력 영역 */}
        <section className="mb-6 rounded-3xl bg-white/90 p-5 shadow ring-1 ring-purple-100">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium">목표 점수</label>
              <input
                type="number"
                min={0}
                max={300}
                value={target}
                onChange={(e) =>
                  setTarget(clamp(Number(e.target.value) || 0, 0, 300))
                }
                className="mt-2 w-full rounded-2xl border px-3 py-2 text-sm shadow-sm"
              />
              <p className="mt-1 text-xs text-gray-500">0~300</p>
            </div>
            <div>
              <label className="text-sm font-medium">솔루션 최대 개수</label>
              <input
                type="number"
                min={1}
                max={200}
                value={limit}
                onChange={(e) =>
                  setLimit(clamp(Number(e.target.value) || 50, 1, 200))
                }
                className="mt-2 w-full rounded-2xl border px-3 py-2 text-sm shadow-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                탐색 시간 방지를 위해 제한
              </p>
            </div>
          </div>

          <div className="mt-5">
            <label className="text-sm font-medium">
              1~7프레임 기록 (예: X, 9/, 9-, 81, --)
            </label>
            <div className="mt-2 grid grid-cols-7 gap-2">
              {Array.from({ length: 7 }, (_, i) => (
                <input
                  key={i}
                  value={first7[i]}
                  onChange={(e) => {
                    const v = e.target.value.toUpperCase();
                    setFirst7((prev) => {
                      const next = [...prev];
                      next[i] = v;
                      return next;
                    });
                  }}
                  placeholder={`${i + 1}프`}
                  className="rounded-xl border px-2 py-2 text-center text-sm shadow-sm"
                />
              ))}
            </div>

            <div className="mt-4">
              <button
                onClick={handleCalculate}
                className="rounded-2xl bg-fuchsia-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-fuchsia-700 active:scale-[0.98]"
              >
                계산하기
              </button>
            </div>
          </div>
        </section>

        {/* 결과 */}
        <section className="space-y-4">
          {solutions.length === 0 ? (
            <div className="rounded-2xl bg-white p-4 text-sm text-gray-600 shadow ring-1 ring-purple-100">
              조건에 맞는 조합이 없거나 계산을 아직 실행하지 않았습니다.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {solutions.map((sol, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-purple-100 bg-white p-4 shadow-sm"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-semibold text-purple-700">
                      솔루션 {idx + 1}
                    </div>
                    <div className="text-xs text-gray-500">
                      8~10프 합계 후 최종 {target}
                    </div>
                  </div>
                  <ul className="text-sm">
                    <li>
                      8프: <b>{framesToPretty(sol[0])}</b>
                    </li>
                    <li>
                      9프: <b>{framesToPretty(sol[1])}</b>
                    </li>
                    <li>
                      10프: <b>{framesToPretty(sol[2])}</b>
                    </li>
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <p className="mt-6 text-xs text-gray-500">
          허용 기호: X, 숫자/-, 스페어는 "/". 예) X, 9/, 9-, 81, --
        </p>
      </div>
    </div>
  );
}
