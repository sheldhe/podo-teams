// src/page/Home.tsx
import { Link, useNavigate } from "react-router-dom";
import { InstagramIcon } from "../icons/InstagramIcon";
import { KakaoIcon } from "../icons/KakaoIcon";

export default function HomePage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-white to-purple-50">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* 헤더 */}
        <header className="mb-8 flex items-center gap-3">
          <img
            src="/images/logo.png"
            alt="Podo Bowling Club"
            className="h-14 w-14 rounded-xl shadow"
          />
          <div>
            <h1 className="text-2xl font-extrabold text-purple-700">
              Podo Bowling Club
            </h1>
            <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
              <a
                href="https://www.instagram.com/podo_bowling/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-purple-600"
              >
                <InstagramIcon /> Instagram
              </a>
              <a
                href="https://open.kakao.com/o/g2z6w5Hh"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-yellow-600"
              >
                <KakaoIcon /> OpenTalk
              </a>
            </div>
          </div>
        </header>

        {/* 본문: 좌측 버튼 / 우측 프리뷰 */}
        <main className="grid gap-6 md:grid-cols-2">
          {/* 왼쪽: 모드 버튼 */}
          <section className="rounded-3xl bg-white/90 p-6 shadow-lg ring-1 ring-purple-100">
            <h2 className="mb-3 text-lg font-bold">모드 선택</h2>
            <p className="mb-6 text-sm text-gray-600">
              원하는 모드를 선택해 시작하세요.
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => navigate("/main")}
                className="w-full rounded-2xl bg-purple-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-purple-700 active:scale-[0.98]"
              >
                일반 모드
              </button>
              <button
                onClick={() => navigate("/random")}
                className="w-full rounded-2xl border border-fuchsia-200 bg-white px-6 py-3 text-sm font-semibold text-fuchsia-700 shadow hover:bg-fuchsia-50 active:scale-[0.98]"
              >
                랜덤 모드
              </button>
              <button
                onClick={() => navigate("/count")}
                className="w-full rounded-2xl border border-fuchsia-200 bg-white px-6 py-3 text-sm font-semibold text-fuchsia-700 shadow hover:bg-fuchsia-50 active:scale-[0.98]"
              >
                맞춤 점수 찾기
              </button>

              {/* 링크로 하고 싶으면 버튼 대신 이렇게 */}
              {/* <Link to="/main" className="...">일반 모드</Link>
                  <Link to="/random" className="...">랜덤 모드</Link> */}
            </div>
          </section>

          {/* 오른쪽: 프리뷰 카드 */}
          <section className="rounded-3xl bg-white/90 p-6 shadow-lg ring-1 ring-purple-100">
            <h2 className="mb-3 text-lg font-bold">프리뷰</h2>
            <div className="flex items-center gap-4 rounded-2xl border border-purple-100 bg-gradient-to-br from-white to-purple-50 p-4 shadow-sm">
              <img
                src="/images/logo.png"
                alt="preview"
                className="h-16 w-16 rounded-lg shadow"
              />
              <div>
                <div className="text-sm font-semibold text-purple-700">
                  Podo Bowling
                </div>
                <div className="text-xs text-gray-500">
                  시드 분배 · 레인 최대 6명 · 랜덤 이벤트
                </div>
              </div>
            </div>

            <ul className="mt-5 grid grid-cols-2 gap-3 text-xs text-gray-600">
              <li className="rounded-xl bg-white p-3 shadow ring-1 ring-purple-100">
                • 인원 10~24 지원
              </li>
              <li className="rounded-xl bg-white p-3 shadow ring-1 ring-purple-100">
                • 레인당 최대 6명
              </li>
              <li className="rounded-xl bg-white p-3 shadow ring-1 ring-purple-100">
                • 시드 정렬 + 스네이크
              </li>
              <li className="rounded-xl bg-white p-3 shadow ring-1 ring-purple-100">
                • 랜덤 미니 룰/테마
              </li>
            </ul>
          </section>
        </main>

        {/* 푸터 */}
        <footer className="mt-10 flex items-center justify-between text-xs text-gray-400">
          <div>© {new Date().getFullYear()} Podo Bowling Club</div>
          <div className="flex items-center gap-2">
            <Link to="/main" className="hover:text-purple-600">
              일반 모드
            </Link>
            <span>·</span>
            <Link to="/random" className="hover:text-purple-600">
              랜덤 모드
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
