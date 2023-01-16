import Link from "next/link";

export default function NotFound() {
  return (
    <main className="main c-container">
      <div className="flex flex-col items-start gap-5">
        <h2 className="title">404</h2>
        <p className="c-description">
          The post you are looking for does not exist.
        </p>
      </div>
      <Link
        href="/posts"
        className="group hover:bg-secondary hover:dark:bg-primary relative inline-flex transition ease-in-out rounded mt-7 self-center"
        aria-label="Open GitHub">
        <span className="c-button-secondary transform group-hover:-translate-x-1 group-hover:-translate-y-1 text-base">
          Go back
        </span>
      </Link>
    </main>
  );
}
