import Image from "@chia/ui/image";
import ImageZoom from "@chia/ui/image-zoom";

export default function Error() {
  return (
    <div className="c-bg-third relative flex min-h-[320px] w-full flex-col items-center justify-center overflow-hidden rounded-lg p-3 px-5">
      <h3 className="my-2">
        Here looks a little boring, I'll prepare it for you soon
      </h3>
      <ImageZoom>
        <div className="not-prose aspect-h-1 aspect-w-1 relative w-[200px]">
          <Image
            src="https://pliosymjzzmsswrxbkih.supabase.co/storage/v1/object/public/public-assets/memo.png"
            alt="memo"
            className="object-cover"
            fill
            loading="lazy"
          />
        </div>
      </ImageZoom>
      <div className="dark:c-bg-gradient-purple-to-pink c-bg-gradient-yellow-to-pink absolute -z-40 size-full opacity-50 blur-3xl" />
    </div>
  );
}
