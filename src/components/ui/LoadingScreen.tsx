export function LoadingScreen({ message = 'Memuat...' }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-bg dark:bg-slate-950">
      <div className="relative">
        <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30 animate-pulse">
          <span className="text-white font-bold text-xl">HR</span>
        </div>
        <div className="absolute -inset-2 rounded-3xl border-2 border-primary/30 animate-ping" />
      </div>
      <p className="mt-6 text-sm font-medium text-slate-500 dark:text-slate-400 animate-pulse">{message}</p>
      <div className="mt-4 w-48 h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full animate-loading-bar" />
      </div>
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-slate-400">Memuat data...</p>
      </div>
    </div>
  );
}
