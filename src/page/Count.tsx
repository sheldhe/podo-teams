import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

/**
 * CountPage – 목표 점수 역산 (8~10프 수동 입력/자동 보완)
 * - 1~10프 모두 입력 가능
 * - 8~10프 중 비어있는 것만 자동 탐색해서 목표 점수(예: 210)에 맞는 조합 제시
 * - 현실성 정렬(9/ 우대, 연속 X 감점 등) 토글
 * - 첫구 0(–) 금지 토글
 * - 프레임 픽커 모달(10프 전용 빠른 버튼 포함) + 직접 입력(키패드)
 */

export type Frame = number[]; // 각 프레임의 투구 핀수 배열 (10프는 2~3개)

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

/* -------------------- 파서/표기 -------------------- */
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

/* -------------------- 점수 계산 -------------------- */
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

/* -------------------- 후보 생성: 필터/무필터 -------------------- */
function generateNormalFrameCandidates_NoFilter(): Frame[] {
  const res: Frame[] = [];
  res.push([10]);
  for (let a = 0; a <= 9; a++) res.push([a, 10 - a]);
  for (let a = 0; a <= 9; a++) {
    for (let b = 0; b <= 9 - a; b++) res.push([a, b]);
  }
  return res;
}
function generateTenthFrameCandidates_NoFilter(): Frame[] {
  const res: Frame[] = [];
  for (let a = 0; a <= 9; a++) {
    for (let b = 0; b <= 9 - a; b++) res.push([a, b]);
  }
  for (let a = 0; a <= 9; a++) {
    for (let c = 0; c <= 10; c++) res.push([a, 10 - a, c]);
  }
  for (let b = 0; b <= 10; b++) {
    if (b === 10) {
      for (let c = 0; c <= 10; c++) res.push([10, b, c]);
    } else {
      for (let c = 0; c <= 10 - b; c++) res.push([10, b, c]);
    }
  }
  return res;
}

// 첫구 0 금지
function generateNormalFrameCandidates_FilterFirstZero(): Frame[] {
  const res: Frame[] = [];
  res.push([10]);
  for (let a = 1; a <= 9; a++) res.push([a, 10 - a]);
  for (let a = 1; a <= 9; a++) {
    for (let b = 0; b <= 9 - a; b++) res.push([a, b]);
  }
  return res;
}
function generateTenthFrameCandidates_FilterFirstZero(): Frame[] {
  const res: Frame[] = [];
  for (let a = 1; a <= 9; a++) {
    for (let b = 0; b <= 9 - a; b++) res.push([a, b]);
  }
  for (let a = 1; a <= 9; a++) {
    for (let c = 0; c <= 10; c++) res.push([a, 10 - a, c]);
  }
  for (let b = 0; b <= 10; b++) {
    if (b === 10) {
      for (let c = 0; c <= 10; c++) res.push([10, b, c]);
    } else {
      for (let c = 0; c <= 10 - b; c++) res.push([10, b, c]);
    }
  }
  return res;
}

const NORMAL_CAND_FILTER = generateNormalFrameCandidates_FilterFirstZero();
const TENTH_CAND_FILTER = generateTenthFrameCandidates_FilterFirstZero();

/* -------------------- 현실성 정렬 -------------------- */
const WEIGHTS = {
  spareBase: 5,
  spareFirstBallMul: 2,
  strikePenalty: -3,
  consecutiveStrikePenalty: -4,
  openFirstBallMul: 1,
  openSecondBallMul: 0.5,
  gutterFirstPenalty: -8,
  tenthNiceBonus: 2,
  tripleXPenalty: -2,
};

function isStrikeFrame(f: Frame) {
  return f.length === 1 && f[0] === 10;
}
function isSpareFrame(f: Frame) {
  return f.length === 2 && f[0] + f[1] === 10 && f[0] !== 10;
}
function isOpenFrame(f: Frame) {
  return f.length === 2 && f[0] + f[1] < 10;
}
function isTenthLikeStrike(f: Frame) {
  return f.length === 3 && f[0] === 10;
}
function isTenthLikeSpare(f: Frame) {
  return f.length === 3 && f[0] + f[1] === 10 && f[0] !== 10;
}

function scoreRealism(frames: [Frame, Frame, Frame]): number {
  const [f8, f9, f10] = frames;
  let s = 0;

  const mids = [f8, f9];
  for (let i = 0; i < mids.length; i++) {
    const f = mids[i];
    if (isStrikeFrame(f)) {
      s += WEIGHTS.strikePenalty;
      if (i > 0 && isStrikeFrame(mids[i - 1]))
        s += WEIGHTS.consecutiveStrikePenalty;
    } else if (isSpareFrame(f)) {
      const a = f[0];
      s += WEIGHTS.spareBase + a * WEIGHTS.spareFirstBallMul;
    } else if (isOpenFrame(f)) {
      const [a, b] = f;
      if (a === 0) s += WEIGHTS.gutterFirstPenalty;
      s += a * WEIGHTS.openFirstBallMul + b * WEIGHTS.openSecondBallMul;
    }
  }

  const t = f10;
  if (isTenthLikeStrike(t)) {
    const [, b, c] = t;
    if (b === 10 && c === 10) s += WEIGHTS.tripleXPenalty;
    if (b !== 10 && b + c === 10) s += WEIGHTS.tenthNiceBonus;
  } else if (isTenthLikeSpare(t)) {
    const a = t[0];
    s += WEIGHTS.spareBase + a * WEIGHTS.spareFirstBallMul;
  } else if (t.length === 2) {
    const [a, b] = t;
    if (a === 0) s += WEIGHTS.gutterFirstPenalty;
    s += a * WEIGHTS.openFirstBallMul + b * WEIGHTS.openSecondBallMul;
  }

  if (isStrikeFrame(f8) && isStrikeFrame(f9))
    s += WEIGHTS.consecutiveStrikePenalty;
  return s;
}

/* -------------------- 프레임 픽커(모달) – 직접 입력/키패드 포함 -------------------- */
function FramePicker({
  open,
  index,
  currentValue,
  onSelect,
  onClose,
}: {
  open: boolean;
  index: number | null;
  currentValue: string;
  onSelect: (symbol: string) => void;
  onClose: () => void;
}) {
  const isTenth = index === 9;
  const [draft, setDraft] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (open) {
      setDraft((currentValue || "").toUpperCase());
      setError("");
    }
  }, [open, currentValue]);

  const quickCommon = ["X", "9/", "8/", "7/", "9-", "81", "72", "--"];
  const quickTenth = ["XXX", "XX9", "X9/", "X9-", "9/X", "9/9", "9--"];
  const list = isTenth ? quickTenth : quickCommon;

  // 유효성 검사
  const validate = (text: string) => {
    const s = text.toUpperCase();
    if (!s) return ""; // 빈 문자열은 입력 중 상태
    if (!isTenth && s.length > 2)
      return "1~9프는 최대 2글자까지 입력할 수 있어요";
    const parsed = parseFrameSymbol(s);
    if (!parsed)
      return "형식이 올바르지 않아요 (예: X, 9/, 9-, 81, --, XXX, X9/)";
    // 추가 룰: 1~9프에서 'X' 단독은 허용, 3글자는 금지(위에서 걸림)
    return "";
  };

  useEffect(() => {
    setError(validate(draft));
  }, [draft]);

  const appendChar = (ch: string) => {
    let next = (draft + ch).toUpperCase();

    // 길이 제한
    const maxLen = isTenth ? 3 : 2;
    if (next.length > maxLen) return;

    // X 처리: 1~9프에서는 X 하나로 끝 (원하면 즉시 저장도 가능)
    if (!isTenth && next.length >= 2 && next[0] === "X") {
      // X 다음 추가는 막기
      next = "X";
    }

    setDraft(next);
  };

  const backspace = () => setDraft((d) => d.slice(0, -1));
  const clearAll = () => setDraft("");
  const handleSave = () => {
    const err = validate(draft);
    if (!err && draft) {
      onSelect(draft.toUpperCase());
      onClose();
    } else {
      setError(err || "입력값이 비어 있어요");
    }
  };

  return !open || index === null ? null : (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-3"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="font-semibold">프레임 선택 – {index + 1}프</div>
          <button className="text-sm text-gray-500" onClick={onClose}>
            닫기
          </button>
        </div>

        {/* 빠른 선택 */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {list.map((s) => (
            <button
              key={s}
              onClick={() => {
                setDraft(s);
                setError("");
              }}
              className="rounded-xl border px-3 py-2 text-sm hover:bg-purple-50"
            >
              {s}
            </button>
          ))}
        </div>

        {/* 직접 입력 */}
        <div className="rounded-xl border p-3">
          <div className="mb-2 text-xs text-gray-500">
            직접 입력 (예: X, 9/, 9-, 81, --, 10프 예: XXX, X9/, 9/X)
          </div>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value.toUpperCase())}
            placeholder={
              isTenth ? "예: XXX / X9/ / 9/X" : "예: X / 9/ / 81 / --"
            }
            className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:ring-2 ${
              error
                ? "border-red-400 focus:ring-red-200"
                : "border-gray-200 focus:ring-fuchsia-300"
            }`}
          />
          {error && (
            <div className="mt-1 text-[11px] text-red-500">{error}</div>
          )}

          {/* 모바일 키패드 */}
          <div className="mt-3 grid grid-cols-5 gap-2">
            {[
              "X",
              "9",
              "8",
              "7",
              "6",
              "5",
              "4",
              "3",
              "2",
              "1",
              "0",
              "-",
              "/",
            ].map((k) => (
              <button
                key={k}
                onClick={() => appendChar(k)}
                className="rounded-lg border px-3 py-2 text-sm hover:bg-purple-50"
              >
                {k}
              </button>
            ))}
            <button
              onClick={backspace}
              className="col-span-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
            >
              ⌫ 지우기
            </button>
            <button
              onClick={clearAll}
              className="col-span-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
            >
              전체 삭제
            </button>
            <button
              onClick={handleSave}
              disabled={!!validate(draft) || !draft}
              className={`col-span-1 rounded-lg px-3 py-2 text-sm text-white ${
                !!validate(draft) || !draft
                  ? "bg-gray-300"
                  : "bg-fuchsia-600 hover:bg-fuchsia-700"
              }`}
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------- 메인 컴포넌트 -------------------- */
export default function CountPage() {
  const [target, setTarget] = useState<number>(210);
  const [framesStr, setFramesStr] = useState<string[]>(Array(10).fill(""));
  const [solutions, setSolutions] = useState<Frame[][]>([]);
  const [previewScore, setPreviewScore] = useState<number | null>(null);
  const [limit, setLimit] = useState<number>(50);

  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [showPicker, setShowPicker] = useState<{
    open: boolean;
    index: number | null;
  }>({
    open: false,
    index: null,
  });

  // 설정 토글
  const [preferRealism, setPreferRealism] = useState(true);
  const [forbidFirstZero, setForbidFirstZero] = useState(true);

  console.log(focusedIndex);

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

    const NORMAL_POOL = forbidFirstZero
      ? NORMAL_CAND_FILTER
      : generateNormalFrameCandidates_NoFilter();

    const TENTH_POOL = forbidFirstZero
      ? TENTH_CAND_FILTER
      : generateTenthFrameCandidates_NoFilter();

    const f8List = f8Fixed ? [f8Fixed] : NORMAL_POOL;
    const f9List = f9Fixed ? [f9Fixed] : NORMAL_POOL;
    const f10List = f10Fixed ? [f10Fixed] : TENTH_POOL;

    const prefix: Frame[] = fixed.slice(0, 7).map((fr) => fr ?? []) as Frame[];

    const sols: Frame[][] = [];
    outer: for (const f8 of f8List) {
      for (const f9 of f9List) {
        for (const f10 of f10List) {
          const game = [...prefix, f8, f9, f10];
          const sc = scoreGame(game);
          if (sc === target) {
            sols.push([f8, f9, f10]);
            if (sols.length >= limit * 3) break outer; // 정렬 전에 넉넉히 확보
          }
        }
      }
    }

    if (!sols.length && f8Fixed && f9Fixed && f10Fixed) {
      const sc = scoreGame([...prefix, f8Fixed, f9Fixed, f10Fixed]);
      if (sc === target) sols.push([f8Fixed, f9Fixed, f10Fixed]);
    }

    if (preferRealism) {
      sols.sort(
        (A, B) =>
          scoreRealism(B as [Frame, Frame, Frame]) -
          scoreRealism(A as [Frame, Frame, Frame])
      );
    }

    if (sols.length > limit) sols.length = limit;

    setSolutions(sols);
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-white to-purple-50 px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-center justify-between">
          <Link to="/" className="block">
            <img
              src="/images/logo.png"
              alt="Podo Bowling Club"
              className="h-9 w-9 rounded-xl shadow"
            />
          </Link>
          <h1 className="text-xl font-extrabold text-purple-700">
            목표 점수 역산 (8~10프 수동 입력 가능)
          </h1>
          <div className="text-xs text-gray-500">
            미리 점수: {previewScore ?? "-"} / 타겟 {target}
          </div>
        </header>

        {/* 입력 & 설정 */}
        <section className="mb-6 rounded-3xl bg-white/90 p-5 shadow ring-1 ring-purple-100">
          <div className="grid gap-4 md:grid-cols-4">
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

            <div className="flex items-center gap-3">
              <label className="text-sm font-medium whitespace-nowrap">
                현실성 우선 정렬
              </label>
              <input
                type="checkbox"
                checked={preferRealism}
                onChange={(e) => setPreferRealism(e.target.checked)}
                className="h-4 w-4"
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm font-medium whitespace-nowrap">
                첫구 0(–) 금지
              </label>
              <input
                type="checkbox"
                checked={forbidFirstZero}
                onChange={(e) => setForbidFirstZero(e.target.checked)}
                className="h-4 w-4"
              />
            </div>
          </div>

          <div className="mt-5">
            <label className="text-sm font-medium">
              1~10프레임 기록 (예: X, 9/, 9-, 81, -- · 10프 예: XXX, X9/, 9/X)
            </label>
            <div className="mt-2 grid grid-cols-5 gap-2 md:grid-cols-10">
              {Array.from({ length: 10 }, (_, i) => {
                const parsed = parseFrameSymbol(framesStr[i] ?? "");
                const isInvalid = Boolean(framesStr[i]) && !parsed;

                return (
                  <div key={i} className="flex flex-col items-center gap-1">
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
                      onFocus={() => {
                        setFocusedIndex(i);
                        setShowPicker({ open: true, index: i }); // 포커스 시 모달
                      }}
                      placeholder={`${i + 1}프`}
                      className={`w-full rounded-xl border px-2 py-2 text-center text-sm shadow-sm focus:ring-2 ${
                        isInvalid
                          ? "border-red-400 focus:ring-red-200"
                          : "border-gray-200 focus:ring-fuchsia-300"
                      }`}
                    />
                    {isInvalid && (
                      <div className="text-[10px] text-red-500 mt-1">
                        형식이 올바르지 않습니다
                      </div>
                    )}
                    {/* ✅ 요청사항 1: 인풋 아래 popover/빠른버튼 완전 제거 */}
                  </div>
                );
              })}
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
          허용 기호: X, 숫자/-, 스페어는 "/". 예) X, 9/, 9-, 81, --. 10프 예)
          XXX, X9/, 9/X. 8~10프를 직접 입력하면 해당 프레임은 고정하고 나머지만
          탐색합니다.
        </p>
      </div>

      {/* 프레임 픽커 모달 – 요청사항 2: 직접 입력/키패드 포함 */}
      <FramePicker
        open={showPicker.open}
        index={showPicker.index}
        currentValue={
          showPicker.index !== null ? framesStr[showPicker.index] : ""
        }
        onSelect={(sym) => {
          if (showPicker.index === null) return;
          setFramesStr((prev) => {
            const next = [...prev];
            next[showPicker.index!] = sym;
            return next;
          });
        }}
        onClose={() => {
          setShowPicker({ open: false, index: null });
          setFocusedIndex(null);
        }}
      />
    </div>
  );
}
