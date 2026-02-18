import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";

export default async function Home() {
  const session = await getServerSession();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center bg-bg px-6">
      <div className="max-w-md w-full flex flex-col items-center text-center gap-6">
        {/* 品牌标识 */}
        <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center">
          <svg
            className="w-8 h-8 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 21h18M9 8h1m4 0h1m-9 4h1m4 0h1m-5 4h5m-7-8V3l4 1 4-1v5"
            />
          </svg>
        </div>

        <div>
          <h1 className="text-[2.25rem] font-semibold text-text tracking-tight">
            Vibe Caddie
          </h1>
          <p className="text-[1.125rem] text-secondary mt-1">
            Your calm golf companion
          </p>
        </div>

        <p className="text-[0.9375rem] leading-[1.625rem] text-secondary">
          Get personalized pre-round briefings, track your rounds hole by hole,
          and receive AI-powered insights to play smarter and more relaxed golf.
        </p>

        <Link
          href="/login"
          className="
            inline-flex items-center justify-center
            w-full max-w-[280px] min-h-[48px] rounded-lg px-6 py-3
            bg-accent text-white font-medium text-[1rem]
            hover:bg-accent-hover active:bg-accent-hover
            transition-colors duration-150
          "
        >
          Sign In
        </Link>
      </div>
    </main>
  );
}
