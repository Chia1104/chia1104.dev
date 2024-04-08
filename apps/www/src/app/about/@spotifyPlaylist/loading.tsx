export default function Loading() {
  return (
    <div className="c-bg-third relative grid min-h-[320px] w-full animate-pulse grid-cols-1 gap-2 overflow-hidden rounded-lg p-3 px-5 sm:grid-cols-2">
      <div className="dark:c-bg-gradient-purple-to-pink c-bg-gradient-yellow-to-pink absolute -z-40 size-full opacity-50 blur-3xl" />
    </div>
  );
}
