import { cn } from "@chia/ui/utils/cn.util";

/** The URN from LinkedIn's "Embed this post" code; a post URL's `activity-…` id is not always it. */
const URN_PATTERN = /^urn:li:(?:share|ugcPost|activity):\d+$/;

/** LinkedIn's embed never reports its content height, so each mode gets a fixed one. */
const DEFAULT_HEIGHT = { collapsed: 264, expanded: 560 };

interface LinkedInPostProps {
  urn: string;
  collapsed?: boolean;
  height?: number;
  title?: string;
  className?: string;
}

export const LinkedInPost = ({
  urn,
  collapsed = true,
  height,
  title = "LinkedIn post",
  className,
}: LinkedInPostProps) => {
  // A malformed urn yields neither a working embed nor a working link.
  if (!URN_PATTERN.test(urn)) return null;

  return (
    <figure
      className={cn("not-prose mx-auto my-6 w-full max-w-126", className)}>
      <div className="border-border bg-surface overflow-hidden rounded-xl border">
        <iframe
          src={`https://www.linkedin.com/embed/feed/update/${urn}${collapsed ? "?collapsed=1" : ""}`}
          title={title}
          height={
            height ??
            (collapsed ? DEFAULT_HEIGHT.collapsed : DEFAULT_HEIGHT.expanded)
          }
          loading="lazy"
          allowFullScreen
          className="block w-full"
        />
      </div>
      <figcaption className="mt-2 text-end text-xs">
        <a
          href={`https://www.linkedin.com/feed/update/${urn}`}
          target="_blank"
          rel="noopener noreferrer"
          className="link">
          View on LinkedIn
        </a>
      </figcaption>
    </figure>
  );
};
