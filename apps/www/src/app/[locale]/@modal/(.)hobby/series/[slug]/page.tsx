import { MediaKind } from "@chia/db/types";

import { WorkSheet } from "@/components/hobby/work-sheet";

// One folder per kind in `MEDIA_KIND_SEGMENT`: a `[kind]` folder would intercept article pages too.
const Page = async ({ params }: { params: Promise<{ slug: string }> }) => (
  <WorkSheet kind={MediaKind.Series} slug={(await params).slug} />
);

export default Page;
