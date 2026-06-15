export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/50 dark:bg-white/10">
      <div
        className="h-full rounded-full bg-[linear-gradient(90deg,rgba(140,173,255,0.96),rgba(188,214,255,0.92))] shadow-[0_8px_20px_rgba(104,132,255,0.28)]"
        style={{ width: `${Math.max(0, Math.min(value, 100))}%` }}
      />
    </div>
  );
}
