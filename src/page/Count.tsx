import { useMemo, useState } from "react";

/**
 * CountPage – 목표 점수 역산 (8~10프 수동 입력/자동 보완)
 * - 1~10프 모두 입력 가능
 * - 8~10프 중 비어있는 것만 자동 탐색해서 목표 점수(예: 210)에 맞는 조합 제시
 * - 모두 채우면 최종 점수만 계산/표시
 */

export type Frame = number[]; // 각 프레임의 투구 핀수 배열 (10프는 2~3개)

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

function parseFrameSymbol(sym: string): Frame | null {
  const s = sym.trim().replace(/\s+/g, "").toUpperCase();
  if (!s) return null;
  if (s === "X") return [10];

  if (s.length === 2) {
    const a = s[0] === "-" ? 0 : s[0] === "X" ? 10 : Number(s[0]);
    if (Number.isNaN(a) || a < 0 || a > 10) return null;
    const bChar = s[1];
    if (bChar === "/") {
      if (a >= 10) return null;
      return [a, 10 - a];
    }
    const b = bChar === "-" ? 0 : bChar === "X" ? 10 : Number(bChar);
    if (Number.isNaN(b) || b < 0 || b > 10) return null;
    if (a + b > 10) return null;
    return [a, b];
  }

  if (s.length === 3) {
    const firstTwo = parseFrameSymbol(s.slice(0, 2));
    if (!firstTwo) return null;
    const [a, b] = firstTwo;
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
      if (b !== 10 && b + cc > 10) return null;
      return [a, b, cc];
    }
    if (a + b === 10) return [a, b, cc];
    return null;
  }

  return null;
}

function scoreGame(frames: Frame[]): number {
  const rolls: number[] = [];
  for (let i = 0; i < frames.length; i++) rolls.push(...frames[i]);

  let score = 0;
  let rollIndex = 0;
  for (let frame = 1; frame <= 10; frame++) {
    const first = rolls[rollIndex] ?? 0;
    if (first === 10) {
      score += 10 + (rolls[rollIndex + 1] ?? 0) + (rolls[rollIndex + 2] ?? 0);
      rollIndex += 1;
    } else {
      const a = first;
      const b = rolls[rollIndex + 1] ?? 0;
      const sum = a + b;
      if (sum === 10) {
        score += 10 + (rolls[rollIndex + 2] ?? 0);
      } else {
        score += sum;
      }
      rollIndex += 2;
      if (frame === 10) {
        if (a === 10) {
          score += (rolls[rollIndex] ?? 0) + (rolls[rollIndex + 1] ?? 0);
          rollIndex += 2;
        } else if (sum === 10) {
          score += rolls[rollIndex] ?? 0;
          rollIndex += 1;
        }
      }
    }
  }
  return score;
}

// 후보 생성
function generateNormalFrameCandidates(): Frame[] {
  const res: Frame[] = [];
  res.push([10]); // 스트라이크
  for (let a = 1; a <= 9; a++) res.push([a, 10 - a]); // 스페어 (a=0 제외)
  for (let a = 1; a <= 9; a++) {
    // a=0 제외
    for (let b = 0; b <= 9 - a; b++) res.push([a, b]);
  }
  return res;
}

function generateTenthFrameCandidates(): Frame[] {
  const res: Frame[] = [];
  // 오픈 (첫구는 1~9만 허용)
  for (let a = 1; a <= 9; a++) {
    for (let b = 0; b <= 9 - a; b++) res.push([a, b]);
  }
  // 스페어 + 보너스 (첫구는 1~9만 허용)
  for (let a = 1; a <= 9; a++) {
    for (let c = 0; c <= 10; c++) res.push([a, 10 - a, c]);
  }
  // 1구 스트 + 보너스 2구 (스트라이크는 그대로 허용)
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
  if (fr.length === 1 && fr[0] === 10) return "X";
  if (fr.length === 2) {
    const [a, b] = fr;
    if (a + b === 10) return `${a === 0 ? "-" : a}/`;
    return `${a === 0 ? "-" : a}${b === 0 ? "-" : b}`;
  }
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

function parseFramesUpTo(input: string[], upto: number): Frame[] {
  const res: Frame[] = [];
  for (let i = 0; i < upto; i++) {
    const f = parseFrameSymbol(input[i] ?? "");
    if (f) res.push(f);
    else res.push([] as unknown as Frame); // 자리 유지
  }
  return res;
}

export default function CountPage() {
  const [target, setTarget] = useState<number>(210);
  const [framesStr, setFramesStr] = useState<string[]>(Array(10).fill("")); // 1~10프 문자열
  const [solutions, setSolutions] = useState<Frame[][]>([]);
  const [previewScore, setPreviewScore] = useState<number | null>(null);
  const [limit, setLimit] = useState<number>(50);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const parsedFirst10 = useMemo(
    () => parseFramesUpTo(framesStr, 10),
    [framesStr]
  );

  function handleCalculate() {
    const fixed = parsedFirst10.map((fr) => (fr && fr.length ? fr : null));

    // 미리보기(빈 프레임 0점 가정)
    try {
      const approx = fixed.map((fr) => fr ?? [0, 0]);
      setPreviewScore(scoreGame(approx as Frame[]));
    } catch {
      setPreviewScore(null);
    }

    // 8~10프 중 비어있는 것만 탐색
    const f8Fixed = fixed[7];
    const f9Fixed = fixed[8];
    const f10Fixed = fixed[9];

    const f8List = f8Fixed ? [f8Fixed] : NORMAL_CAND;
    const f9List = f9Fixed ? [f9Fixed] : NORMAL_CAND;
    const f10List = f10Fixed ? [f10Fixed] : TENTH_CAND;

    const prefix: Frame[] = fixed.slice(0, 7).map((fr) => fr ?? []) as Frame[];

    const sols: Frame[][] = [];
    outer: for (const f8 of f8List) {
      for (const f9 of f9List) {
        for (const f10 of f10List) {
          const game = [...prefix, f8, f9, f10];
          const sc = scoreGame(game);
          if (sc === target) {
            sols.push([f8, f9, f10]);
            if (sols.length >= limit) break outer;
          }
        }
      }
    }

    // 8~10 모두 채워졌는데 솔루션이 없을 때: 일치 확인만
    if (!sols.length && f8Fixed && f9Fixed && f10Fixed) {
      const sc = scoreGame([...prefix, f8Fixed, f9Fixed, f10Fixed]);
      if (sc === target) sols.push([f8Fixed, f9Fixed, f10Fixed]);
    }

    setSolutions(sols);
  }

  const quick = ["X", "9/", "9-", "--", "81", "54", "00"];

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-white to-purple-50 px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-extrabold text-purple-700">
            목표 점수 역산 (8~10프 수동 입력 가능)
          </h1>
          <div className="text-xs text-gray-500">
            미리 점수: {previewScore ?? "-"} / 타겟 {target}
          </div>
        </header>

        {/* 입력 */}
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
              <p className="mt-1 text-xs text-gray-500">탐색 비용 제한</p>
            </div>
          </div>

          <div className="mt-5">
            <label className="text-sm font-medium">
              1~10프레임 기록 (예: X, 9/, 9-, 81, --)
            </label>
            <div className="mt-2 grid grid-cols-5 gap-2 md:grid-cols-10">
              {Array.from({ length: 10 }, (_, i) => (
                <div
                  key={i}
                  className="relative flex flex-col items-center gap-1"
                >
                  <input
                    value={framesStr[i]}
                    onChange={(e) => {
                      const v = e.target.value.toUpperCase();
                      setFramesStr((prev) => {
                        const next = [...prev];
                        next[i] = v;
                        return next;
                      });
                    }}
                    onFocus={() => setFocusedIndex(i)}
                    onBlur={() => {
                      // 버튼 클릭 시 blur로 사라지는 문제 방지: 약간 딜레이 후 닫기
                      setTimeout(() => {
                        setFocusedIndex((cur) => (cur === i ? null : cur));
                      }, 80);
                    }}
                    placeholder={`${i + 1}프`}
                    className="w-full rounded-xl border px-2 py-2 text-center text-sm shadow-sm focus:ring-2 focus:ring-fuchsia-300"
                  />

                  {/* ✅ 포커스된 칸에서만 추천 버튼 노출 */}
                  {focusedIndex === i && (
                    <div className="absolute top-[110%] z-10 flex gap-1 rounded-xl border bg-white p-1 shadow">
                      {quick.map((q) => (
                        <button
                          key={q}
                          // mousedown에서 처리하면 input blur 전에 값이 들어감
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setFramesStr((prev) => {
                              const next = [...prev];
                              next[i] = q;
                              return next;
                            });
                          }}
                          className="rounded px-2 py-1 text-[11px] ring-1 ring-purple-200 hover:bg-purple-50"
                        >
                          {q}
                        </button>
                      ))}
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setFramesStr((prev) => {
                            const next = [...prev];
                            next[i] = "";
                            return next;
                          });
                        }}
                        className="rounded px-2 py-1 text-[11px] ring-1 ring-gray-200 hover:bg-gray-50"
                      >
                        지우기
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={handleCalculate}
                className="rounded-2xl bg-fuchsia-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-fuchsia-700 active:scale-[0.98]"
              >
                계산하기
              </button>
              <button
                onClick={() => setFramesStr(Array(10).fill(""))}
                className="rounded-2xl border border-purple-200 bg-white px-4 py-2 text-xs text-purple-700 shadow-sm hover:bg-purple-50"
              >
                전체 지우기
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
                    <div className="text-xs text-gray-500">최종 {target}</div>
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
          허용 기호: X, 숫자/-, 스페어는 "/". 예) X, 9/, 9-, 81, --. 8~10프를
          직접 입력하면 해당 프레임은 고정하고 나머지만 탐색합니다.
        </p>
      </div>
    </div>
  );
}
