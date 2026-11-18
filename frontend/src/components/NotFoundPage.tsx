import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4 py-16 text-center">
      <div>
        <p className="text-6xl font-semibold text-white/20">404</p>
        <h1 className="mt-3 text-xl font-semibold text-white">Page not found</h1>
        <p className="mt-2 text-sm text-slate-400">There is nothing at this address.</p>
        <Link to="/" className="mt-6 inline-block text-sm text-orange-400 hover:text-orange-300">
          Back to homepage
        </Link>
      </div>
    </main>
  );
}
