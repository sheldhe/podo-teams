import { useMemo, useState } from "react";

/**
 * RandomPage – 그룹 기반 랜덤 팀 배치 (에버 없음)
 * 요구사항 요약:
 * 1) 에버 없음
 * 2) 인원수/팀 수에 따라 팀 구성 (예: 총 3팀)
 * 3) 그룹(1~N 그룹)에서 무작위로 팀에 배치
 * 4) 그룹별로 가능한 한 공평하게 1팀,2팀,3팀에 분배 (라운드마다 시작 팀을 회전)
 * 5) 인원부족/불균형 허용 (팀 크기는 달라도 됨)
 * 6) 총 3번 돌려서(3라운드) 다양한 조합 제공
 *
 * 구현 포인트:
 * - 각 라운드마다: 그룹별로 셔플 → (i + roundOffset) % teamCount 규칙으로 라운드로빈 분배
 * - 라운드마다 시작팀 오프셋을 바꿔(회전) 다양한 조합 유도
 * - 간단한 중복 페어(동일 팀 경험) 카운트 표시 – variety 지표
 */

type GroupsMap = Record<string, string[]>; // { "1그룹": ["이름", ...], ... }

type TeamAssignment = string[][]; // teams[teamIdx] = [names]

type RoundResult = {
  teams: TeamAssignment;
  pairRepeats: number; // 누적 페어 중복 수(이전 라운드 대비)
};

const DEFAULT_GROUPS: GroupsMap = {
  "1그룹": ["이희재", "양효천", "박세현", "정서윤", "임지수", "김지윤"],
  "2그룹": ["유혜정", "신현섭", "최대한", "이기정", "곽대현", "최연식"],
  "3그룹": ["황지민", "김강엽", "정기훈"],
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function distributeGroupToTeams(
  players: string[],
  teamCount: number,
  startOffset: number
): TeamAssignment {
  const teams: TeamAssignment = Array.from({ length: teamCount }, () => []);
  const shuffled = shuffle(players);
  shuffled.forEach((name, idx) => {
    const teamIdx = (idx + startOffset) % teamCount; // 라운드마다 시작팀 회전
    teams[teamIdx].push(name);
  });
  return teams;
}

function mergeTeams(into: TeamAssignment, add: TeamAssignment) {
  for (let i = 0; i < into.length; i++) into[i].push(...add[i]);
}

function buildPairs(teams: TeamAssignment): Set<string> {
  const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const pairs = new Set<string>();
  for (const team of teams) {
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
        pairs.add(key(team[i], team[j]));
      }
    }
  }
  return pairs;
}

function planOneRound(
  groups: GroupsMap,
  teamCount: number,
  roundIdx: number
): TeamAssignment {
  const result: TeamAssignment = Array.from({ length: teamCount }, () => []);
  // 그룹 순서 자체도 셔플하여 편향 방지
  const groupEntries = shuffle(Object.entries(groups));
  for (const [groupName, members] of groupEntries) {
    if (!members || members.length === 0) continue;
    // 그룹 내 셔플 + 시작 팀 오프셋 적용
    const offset = (roundIdx + groupName.length) % teamCount; // 그룹별로도 약간 변화
    const byGroup = distributeGroupToTeams(members, teamCount, offset);
    mergeTeams(result, byGroup);
  }
  // 팀 내부도 살짝 셔플(표시상 편향 완화)
  for (let i = 0; i < result.length; i++) result[i] = shuffle(result[i]);
  return result;
}

function countPairRepeats(
  prevPairs: Set<string>,
  currentTeams: TeamAssignment
) {
  const now = buildPairs(currentTeams);
  let repeats = 0;
  for (const p of now) if (prevPairs.has(p)) repeats++;
  return { repeats, pairSet: new Set([...prevPairs, ...now]) };
}

export default function RandomPage() {
  const [teamCount, setTeamCount] = useState<number>(3);
  const [groups, setGroups] = useState<GroupsMap>(DEFAULT_GROUPS);
  const [rounds, setRounds] = useState<number>(3);
  const [results, setResults] = useState<RoundResult[]>([]);

  const totalPeople = useMemo(
    () => Object.values(groups).reduce((s, g) => s + g.length, 0),
    [groups]
  );

  // 그룹 키의 숫자 순서(1그룹, 2그룹, 3그룹 ...)를 보장
  const sortGroupKeys = (keys: string[]) => {
    const num = (k: string) => {
      const m = k.match(/\d+/);
      return m ? Number(m[0]) : Number.MAX_SAFE_INTEGER;
    };
    return [...keys].sort((a, b) => num(a) - num(b));
  };

  // name -> groupKey 매핑 만들기
  const buildNameToGroup = (groups: GroupsMap) => {
    const map: Record<string, string> = {};
    for (const [gKey, names] of Object.entries(groups)) {
      for (const n of names) map[n] = gKey;
    }
    return map;
  };

  // 팀을 '그룹 순서'로 정렬 (동일 그룹 내에서는 가나다 정렬)
  const sortTeamByGroupOrder = (
    team: string[],
    nameToGroup: Record<string, string>,
    orderedGroupKeys: string[]
  ) => {
    const idx = (name: string) =>
      orderedGroupKeys.indexOf(nameToGroup[name] ?? "");
    return [...team].sort((a, b) => {
      const da = idx(a);
      const db = idx(b);
      if (da !== db) return da - db;
      return a.localeCompare(b, "ko");
    });
  };

  const runRandomize = () => {
    const r: RoundResult[] = [];
    let pairMemo = new Set<string>();

    // 그룹 순서/매핑 준비
    const orderedGroupKeys = sortGroupKeys(Object.keys(groups));
    const nameToGroup = buildNameToGroup(groups);

    for (let round = 0; round < rounds; round++) {
      let teams = planOneRound(groups, teamCount, round);

      // ⬇️ 각 팀을 '1그룹 → 2그룹 → 3그룹' 순으로 정렬
      teams = teams.map((team) =>
        sortTeamByGroupOrder(team, nameToGroup, orderedGroupKeys)
      );

      const { repeats, pairSet } = countPairRepeats(pairMemo, teams);
      pairMemo = pairSet;
      r.push({ teams, pairRepeats: repeats });
    }
    setResults(r);
  };

  const updateGroupText = (key: string, text: string) => {
    const names = text
      .split(/\n|\r|,|;|\t/)
      .map((v) => v.trim())
      .filter(Boolean);
    setGroups((prev) => ({ ...prev, [key]: names }));
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-white to-purple-50 px-6 py-8">
      <div className="mx-auto max-w-6xl">
        {/* 헤더 */}
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/images/logo.png"
              alt="logo"
              className="h-12 w-12 rounded-xl shadow"
            />
            <div>
              <h1 className="text-xl font-extrabold text-purple-700">
                랜덤 모드
              </h1>
              <p className="text-xs text-gray-500">
                그룹 기반 무작위 팀 배치 · {totalPeople}명
              </p>
            </div>
          </div>
        </header>

        {/* 설정 카드 */}
        <section className="mb-6 rounded-3xl bg-white/90 p-5 shadow ring-1 ring-purple-100">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium">팀 수</label>
              <input
                type="number"
                min={2}
                max={8}
                value={teamCount}
                onChange={(e) =>
                  setTeamCount(
                    Math.max(2, Math.min(8, Number(e.target.value) || 3))
                  )
                }
                className="mt-2 w-full rounded-2xl border px-3 py-2 text-sm shadow-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                예) 3팀이면 1/2/3팀으로 분배
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">라운드 수</label>
              <input
                type="number"
                min={1}
                max={6}
                value={rounds}
                onChange={(e) =>
                  setRounds(
                    Math.max(1, Math.min(6, Number(e.target.value) || 3))
                  )
                }
                className="mt-2 w-full rounded-2xl border px-3 py-2 text-sm shadow-sm"
              />
              <p className="mt-1 text-xs text-gray-500">요청: 기본 3회</p>
            </div>
            <div className="flex items-end">
              <button
                onClick={runRandomize}
                className="w-full rounded-2xl bg-fuchsia-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-fuchsia-700 active:scale-[0.98]"
              >
                랜덤 돌리기
              </button>
            </div>
          </div>
        </section>

        {/* 그룹 편집 */}
        <section className="mb-8 grid gap-4 md:grid-cols-3">
          {Object.entries(groups).map(([key, list]) => (
            <div
              key={key}
              className="rounded-2xl bg-white p-4 shadow ring-1 ring-purple-100"
            >
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold">{key}</h3>
                <span className="text-xs text-gray-400">{list.length}명</span>
              </div>
              <textarea
                className="h-36 w-full resize-none rounded-xl border px-3 py-2 text-sm shadow-sm"
                value={list.join("\n")}
                onChange={(e) => updateGroupText(key, e.target.value)}
                placeholder={`한 줄에 한 명씩 입력`}
              />
            </div>
          ))}
        </section>

        {/* 결과 렌더 */}
        {results.length > 0 && (
          <section className="space-y-8">
            {results.map((round, rIdx) => (
              <div
                key={rIdx}
                className="rounded-3xl bg-white/90 p-5 shadow ring-1 ring-purple-100"
              >
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold">Round {rIdx + 1}</h2>
                  <span className="text-xs text-gray-500">
                    중복 페어: {round.pairRepeats}쌍
                  </span>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  {round.teams.map((team, tIdx) => (
                    <div
                      key={tIdx}
                      className="rounded-2xl border border-purple-100 bg-white p-4 shadow-sm"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-sm font-semibold text-purple-700">
                          {tIdx + 1}팀
                        </div>
                        <div className="text-xs text-gray-400">
                          {team.length}명
                        </div>
                      </div>
                      <ul className="space-y-1 text-sm">
                        {team.map((name, i) => (
                          <li
                            key={name + i}
                            className="rounded-lg bg-purple-50/40 px-2 py-1"
                          >
                            {name}
                          </li>
                        ))}
                        {team.length === 0 && (
                          <li className="text-xs text-gray-400">— 빈 팀 —</li>
                        )}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* 안내 */}
        <p className="mt-8 text-xs text-gray-500">
          규칙: 그룹별 무작위 셔플 → 라운드마다 시작 팀 오프셋을 회전하며
          라운드로빈 분배. 인원수가 팀 수보다 적은 그룹은 일부 팀에만 배정될 수
          있습니다.
        </p>
      </div>
    </div>
  );
}
