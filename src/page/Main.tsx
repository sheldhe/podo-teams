import { useMemo, useState } from "react";

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
  if (n <= 0) return 0;
  return Math.max(2, Math.round(n / maxPerTable));
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

  const teamCount = decideTeamCount(n, maxPerTable);
  const sizes = targetSizes(n, teamCount, maxPerTable);

  const teams: Team[] = Array.from({ length: teamCount }, (_, idx) => ({
    idx,
    players: [],
    sizeLimit: sizes[idx],
  }));

  // Seeding: sort by avg desc
  const seeded = [...players].sort((a, b) => b.avg - a.avg);

  // Assignment: snake while respecting size limits
  const pattern = snakeOrder(teamCount);
  let p = 0; // index within pattern
  for (const pl of seeded) {
    let placed = false;
    let tries = 0;
    while (!placed && tries < teamCount * 2) {
      const teamIdx = pattern[p % pattern.length];
      p++;
      tries++;
      if (teams[teamIdx].players.length < teams[teamIdx].sizeLimit) {
        teams[teamIdx].players.push(pl);
        placed = true;
      }
    }
    if (!placed) {
      // Fallback: put into any team with room
      const t = teams.find((t) => t.players.length < t.sizeLimit);
      if (!t) throw new Error("No room left for player: " + pl.name);
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
  const [raw, setRaw] = useState(
    `서윤, 189\n희재, 222.2\n민지, 160\n지훈, 150\n세라, 145\n수현, 142\n진우, 140\n하나, 138\n태호, 135\n유나, 133\n가영, 132\n도현, 130\n`
  );
  const [maxPerTable, setMaxPerTable] = useState(6);
  const players = useMemo<Player[]>(() => parsePlayers(raw), [raw]);

  const { teams, teamCount } = useMemo(
    () => makeTeams(players, maxPerTable),
    [players, maxPerTable]
  );

  const globalAvg = useMemo(() => {
    if (players.length === 0) return 0;
    return players.reduce((s, p) => s + p.avg, 0) / players.length;
  }, [players]);

  return (
    <div className="min-h-screen w-full bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold mb-4">
          볼링 팀 자동분배 (시드 + 스네이크)
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          인원 {players.length}명, 테이블당 최대 {maxPerTable}명 → 팀 수{" "}
          {teamCount} (예: 10→5x2, 12→6x2, 15→5x3)
        </p>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="flex flex-col">
            <label className="text-sm font-medium mb-2">
              명단 입력 (이름, 에버)
            </label>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              className="h-48 w-full rounded-2xl border px-3 py-2 text-sm shadow-sm focus:outline-none"
              placeholder="예) 홍길동, 155"
            />
            <p className="mt-2 text-xs text-gray-500">
              쉼표/공백 구분 가능. 한 줄에 한 명.
            </p>
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-medium mb-2">테이블 최대 인원</label>
            <input
              type="number"
              min={3}
              max={8}
              value={maxPerTable}
              onChange={(e) => setMaxPerTable(Number(e.target.value) || 6)}
              className="w-40 rounded-2xl border px-3 py-2 text-sm shadow-sm"
            />
            <div className="mt-4 text-sm">
              <div>
                전체 평균: <b>{globalAvg.toFixed(1)}</b>
              </div>
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
  return input
    .split(/\n|\r/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      // Allow formats: "이름, 150" | "이름 150" | "이름\t150"
      const parts = line.split(/[;,\t]|\s{2,}|\s\-\s|\s/).filter(Boolean);
      // Better parsing: try comma first
      const byComma = line.split(",");
      if (byComma.length >= 2) {
        const name = byComma[0].trim();
        const avg = Number(
          byComma
            .slice(1)
            .join(",")
            .replace(/[^0-9.]/g, "")
        );
        return { name, avg: isNaN(avg) ? 0 : avg };
      }
      // Fallback to last token numeric
      const last = parts[parts.length - 1];
      const avg = Number(String(last).replace(/[^0-9.]/g, ""));
      const name =
        parts.slice(0, -1).join(" ") ||
        `Player${Math.random().toString(36).slice(2, 7)}`;
      return { name: name.trim(), avg: isNaN(avg) ? 0 : avg };
    })
    .filter((p) => p.name);
}
