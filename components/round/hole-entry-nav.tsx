"use client";

import { Button } from "@/components/ui/button";

interface HoleEntryNavProps {
  currentHole: number;
  totalHoles: number;
  /** 每个洞是否有数据（数组索引 0 = Hole 1） */
  holesWithData: boolean[];
  onPrev: () => void;
  onNext: () => void;
  onFinish: () => void;
  /** 点击洞号圆点直接跳转 */
  onJumpTo?: (holeNumber: number) => void;
}

/** 洞导航组件 — 上一洞/下一洞 + 圆点指示器 */
export function HoleEntryNav({
  currentHole,
  totalHoles,
  holesWithData,
  onPrev,
  onNext,
  onFinish,
  onJumpTo,
}: HoleEntryNavProps) {
  const isFirst = currentHole === 1;
  const isLast = currentHole === totalHoles;

  return (
    <div className="flex flex-col gap-4">
      {/* 洞号圆点指示器 */}
      <div className="flex justify-center gap-1.5 flex-wrap">
        {Array.from({ length: totalHoles }, (_, i) => {
          const holeNum = i + 1;
          const hasData = holesWithData[i] ?? false;
          const isCurrent = holeNum === currentHole;

          return (
            <button
              key={holeNum}
              type="button"
              onClick={() => {
                if (!isCurrent && onJumpTo) onJumpTo(holeNum);
              }}
              className={`
                w-7 h-7 rounded-full flex items-center justify-center
                text-[0.6875rem] font-medium transition-colors duration-150
                ${onJumpTo ? "cursor-pointer" : "cursor-default"}
                ${
                  isCurrent
                    ? "bg-accent text-white ring-2 ring-accent/30"
                    : hasData
                    ? "bg-accent/20 text-accent hover:bg-accent/30"
                    : "bg-gray-200 text-secondary hover:bg-gray-300"
                }
              `}
            >
              {holeNum}
            </button>
          );
        })}
      </div>

      {/* 当前洞号 / 总洞数 */}
      <p className="text-center text-[0.875rem] text-secondary">
        {currentHole} / {totalHoles}
      </p>

      {/* 导航按钮 */}
      <div className="flex gap-3">
        <Button
          variant="secondary"
          onClick={onPrev}
          disabled={isFirst}
          className="flex-1"
        >
          &larr; Prev
        </Button>

        {isLast ? (
          <Button
            variant="primary"
            onClick={onFinish}
            className="flex-1"
          >
            Finish Round
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={onNext}
            className="flex-1"
          >
            Next &rarr;
          </Button>
        )}
      </div>
    </div>
  );
}
