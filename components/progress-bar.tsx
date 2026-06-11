export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[#dfe8dc]">
      <div className="h-full rounded-full bg-moss" style={{ width: `${Math.max(0, Math.min(value, 100))}%` }} />
    </div>
  );
}
