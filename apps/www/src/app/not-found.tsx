import Link from "next/link";

export default function NotFound() {
  return (
    <body className="c-bg-primary scrollbar-thin scrollbar-thumb-secondary scrollbar-thumb-rounded-full">
      <main className="main c-container">
        <div className="flex flex-col items-start gap-5">
          <h2 className="title">404</h2>
          <p className="c-description">
            The page you are looking for does not exist.
          </p>
        </div>
        <Link
          href="/"
          className="hover:bg-secondary hover:dark:bg-primary group relative mt-7 inline-flex self-center rounded transition ease-in-out"
          aria-label="Go back">
          <span className="c-button-secondary transform text-base group-hover:-translate-x-1 group-hover:-translate-y-1">
            Go back
          </span>
        </Link>
      </main>
    </body>
  );
}
