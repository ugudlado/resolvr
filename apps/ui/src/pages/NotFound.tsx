import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--bg-base)] text-slate-200">
      <h1 className="text-4xl font-bold text-slate-400">404</h1>
      <p className="text-slate-500">Page not found</p>
      <Link
        to="/"
        className="rounded border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-2 text-sm text-slate-300 hover:bg-[var(--border-default)]"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
