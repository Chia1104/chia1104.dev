import { createFeedOpenGraphImage } from "@/services/feed-open-graph.service";

export const alt = "Blog";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function og({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;

  return createFeedOpenGraphImage({ slug, locale });
}
