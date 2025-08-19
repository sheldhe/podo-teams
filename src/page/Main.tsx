import { useEffect, useMemo, useState } from "react";

/**
 * Bowling team maker
 * - Input: list of players with name and average (ever)
 * - Rule highlights from user:
 *   1) People: min 10 ~ max 24
 *   2) A table (lane) can host up to 6 people
 *   3) Make seeds and balance teams by average
 *   4) Examples: 10 -> 5x2, 12 -> 6x2, 15 -> 5x3
 *
 * Implementation:
 * - Determine teamCount = round(n / maxPerTable) (fits examples above). min 2.
 * - Compute target sizes for each team so no team exceeds maxPerTable and sizes differ by at most 1.
 * - Sort by average desc (seeding), assign in a snake pattern while respecting target sizes.
 */

// ---------- Types ----------
export type Player = { name: string; avg: number };
export type Team = { idx: number; players: Player[]; sizeLimit: number };

// ---------- Core Logic ----------
function decideTeamCount(n: number, maxPerTable: number) {
  // ceil로 바꿔서 항상 총 수용 인원이 참가자 이상이 되게
  const cap = Math.max(2, Math.min(12, Math.floor(maxPerTable))); // 최소 2, 최대 12 같은 가드
  if (n <= 0) return 0;
  return Math.max(2, Math.ceil(n / cap));
}

function targetSizes(n: number, teams: number, maxPerTable: number): number[] {
  // base even split
  const base = Math.floor(n / teams);
  let rem = n % teams; // first `rem` teams get +1
  const sizes = Array.from({ length: teams }, () => base);
  for (let i = 0; i < teams; i++) {
    if (rem > 0) {
      sizes[i] += 1;
      rem--;
    }
  }
  // ensure none exceed max
  for (let i = 0; i < teams; i++) {
    if (sizes[i] > maxPerTable) {
      // push overflow to later teams (or previous if needed)
      let overflow = sizes[i] - maxPerTable;
      sizes[i] = maxPerTable;
      let j = i + 1;
      while (overflow > 0 && j < teams) {
        const canTake = Math.min(maxPerTable - sizes[j], overflow);
        sizes[j] += canTake;
        overflow -= canTake;
        j++;
      }
      // if still overflow, go backwards
      j = i - 1;
      while (overflow > 0 && j >= 0) {
        const canTake = Math.min(maxPerTable - sizes[j], overflow);
        sizes[j] += canTake;
        overflow -= canTake;
        j--;
      }
      if (overflow > 0)
        throw new Error("Cannot fit players within maxPerTable");
    }
  }
  return sizes;
}

function snakeOrder(k: number): number[] {
  // e.g., k=4 => [0,1,2,3, 3,2,1,0, 0,1,2,3, ...]
  const forward = Array.from({ length: k }, (_, i) => i);
  const backward = Array.from({ length: k }, (_, i) => k - 1 - i);
  return [...forward, ...backward];
}

function makeTeams(players: Player[], maxPerTable = 6) {
  const n = players.length;
  if (n === 0) return { teams: [], sizes: [], teamCount: 0 };

  // 가드: maxPerTable이 0, 음수, NaN이 들어오지 않게
  const cap = Math.max(2, Math.min(12, Math.floor(maxPerTable)));

  const teamCount = decideTeamCount(n, cap);
  const sizes = targetSizes(n, teamCount, cap);

  const teams: Team[] = Array.from({ length: teamCount }, (_, idx) => ({
    idx,
    players: [],
    sizeLimit: sizes[idx],
  }));

  const seeded = [...players].sort((a, b) => b.avg - a.avg);

  const pattern = snakeOrder(teamCount);
  let p = 0;

  for (const pl of seeded) {
    // 먼저 스네이크 순서대로 넣어보고
    let placed = false;
    for (let tries = 0; tries < pattern.length; tries++) {
      const teamIdx = pattern[(p + tries) % pattern.length];
      if (teams[teamIdx].players.length < teams[teamIdx].sizeLimit) {
        teams[teamIdx].players.push(pl);
        placed = true;
        p = (p + tries + 1) % pattern.length;
        break;
      }
    }
    // 그래도 못 넣으면, 남는 팀 아무 데나 (절대 throw 안 함)
    if (!placed) {
      const t = teams.find((t) => t.players.length < t.sizeLimit) ?? teams[0];
      t.players.push(pl);
    }
  }

  return { teams, sizes, teamCount };
}

function teamAvg(t: Team) {
  if (t.players.length === 0) return 0;
  const sum = t.players.reduce((s, p) => s + p.avg, 0);
  return sum / t.players.length;
}

// ---------- Demo Component ----------
export default function MainPage() {
  const [source, setSource] = useState<"manual" | "sheet">("sheet");
  const [raw, setRaw] = useState("이름, 에버\n"); // 헤더 1행 포함 추천
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);

  const [maxPerTable, setMaxPerTable] = useState(6);

  // 2) players는 항상 raw에서 파생
  const players = useMemo(() => parsePlayers(raw), [raw]);

  const { teams, teamCount } = useMemo(
    () => makeTeams(players, maxPerTable),
    [players, maxPerTable]
  );

  const globalAvg = useMemo(() => {
    if (players.length === 0) return 0;
    return players.reduce((s, p) => s + p.avg, 0) / players.length;
  }, [players]);

  useEffect(() => {
    if (source !== "sheet") return;

    const url =
      "https://docs.google.com/spreadsheets/d/1Q97suapoy2sHlRz-mBHJzNCREqKuJgAVK98827avlBs/gviz/tq?tqx=out:csv&gid=0";

    setSheetLoading(true);
    setSheetError(null);

    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((csv) => {
        // CSV -> raw (그대로 붙여넣기 가능한 텍스트로)
        // A: 이름, B: 에버 가정. 헤더 포함이면 그대로 두는 게 파싱에 유리.
        // 헤더 없으면 수동으로 추가해도 됨: setRaw("이름, 에버\n" + csv)
        setRaw(csv.trim());
      })
      .catch((e) => setSheetError(String(e)))
      .finally(() => setSheetLoading(false));
  }, [source]);

  return (
    <div className="min-h-screen w-full bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold mb-4">
          볼링 팀 자동분배 (시드 + 스네이크)
        </h1>
        <p className="text-sm text-gray-600 mb-2">
          인원 {players.length}명, 테이블당 최대 {maxPerTable}명 → 팀 수{" "}
          {teamCount} (예: 10→5x2, 12→6x2, 15→5x3)
        </p>

        {/* 데이터 소스 선택 */}
        <div className="mb-6 flex items-center gap-3">
          <label className="text-sm font-medium">데이터 소스</label>
          <select
            className="rounded-xl border px-3 py-2 text-sm"
            value={source}
            onChange={(e) => setSource(e.target.value as "manual" | "sheet")}
          >
            <option value="sheet">스프레드시트(CSV)</option>
            <option value="manual">수동 입력</option>
          </select>
          {source === "sheet" && (
            <>
              {sheetLoading && (
                <span className="text-xs text-gray-500">불러오는 중…</span>
              )}
              {sheetError && (
                <span className="text-xs text-red-500">
                  로드 실패: {sheetError}
                </span>
              )}
              <button
                className="rounded-lg border px-3 py-1 text-xs"
                onClick={() => {
                  // 강제 새로고침: 소스 토글로 useEffect 재실행
                  setSource("manual");
                  setTimeout(() => setSource("sheet"), 0);
                }}
              >
                새로고침
              </button>
            </>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="flex flex-col">
            <label className="text-sm font-medium mb-2">
              명단 입력 (이름, 에버)
            </label>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              className="h-48 w-full rounded-2xl border px-3 py-2 text-sm shadow-sm focus:outline-none"
              placeholder="예) 이름, 155  (CSV/헤더 허용: '이름, 에버')"
            />
            <p className="mt-2 text-xs text-gray-500">
              CSV 또는 한 줄에 한 명. 헤더가 있어도 자동 인식.
            </p>
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium mb-2">테이블 최대 인원</label>
            <input
              type="number"
              min={2}
              max={12}
              value={maxPerTable}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isNaN(v)) return;
                // 2~12 사이 정수로 클램프
                const clamped = Math.max(2, Math.min(12, Math.floor(v)));
                setMaxPerTable(clamped);
              }}
              className="w-40 rounded-2xl border px-3 py-2 text-sm shadow-sm"
            />
            <div className="mt-4 text-sm">
              전체 평균: <b>{globalAvg.toFixed(1)}</b>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {teams.map((t) => (
            <div key={t.idx} className="rounded-2xl bg-white shadow p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-semibold">팀 {t.idx + 1}</h2>
                <span className="text-xs text-gray-500">
                  {t.players.length}/{t.sizeLimit}
                </span>
              </div>
              <div className="text-sm mb-2">
                팀 평균: <b>{teamAvg(t).toFixed(1)}</b>
              </div>
              <ul className="space-y-1 text-sm">
                {t.players.map((p, i) => (
                  <li
                    key={p.name + i}
                    className="flex justify-between border-b last:border-b-0 py-1"
                  >
                    <span>{p.name}</span>
                    <span className="tabular-nums">{p.avg.toFixed(1)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 text-xs text-gray-500">
          <p>
            배치 로직: 상위 에버부터 정렬 → 스네이크(정/역순 반복)로 팀에 배치 →
            각 팀은 목표 인원 제한을 초과하지 않게 채움.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------- Helpers ----------
function parsePlayers(input: string): Player[] {
  if (!input?.trim()) return [];

  const lines = input.trim().split(/\r?\n/);

  // 1) 헤더 자동 감지 (첫 줄에 '이름'과 '에버'가 있으면 스킵)
  const hasHeader = /이름/i.test(lines[0]) && /에버|평균|avg/i.test(lines[0]);

  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      // CSV 우선
      const comma = line.split(",");
      if (comma.length >= 2) {
        const name = comma[0]?.trim() ?? "";
        const avg = Number((comma[1] ?? "").replace(/[^0-9.]/g, ""));
        return name ? { name, avg: isNaN(avg) ? 0 : avg } : null;
      }
      // 공백 구분 보조
      const parts = line.split(/\s+/);
      const avgTok = parts.at(-1) ?? "";
      const avg = Number(String(avgTok).replace(/[^0-9.]/g, ""));
      const name = parts.slice(0, -1).join(" ");
      return name ? { name, avg: isNaN(avg) ? 0 : avg } : null;
    })
    .filter((p): p is Player => Boolean(p));
}
