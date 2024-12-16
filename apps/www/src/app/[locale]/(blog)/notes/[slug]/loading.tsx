export const MetaSkeletons = () => {
  return (
    <>
      <header className="mb-7 w-full">
        <span className="mb-4 w-full h-[3rem] rounded-lg animate-pulse bg-default" />
        <span className="mb-4 w-full h-[1rem] rounded-full animate-pulse bg-default" />
        <span className="mb-4 w-full h-[1rem] rounded-full animate-pulse bg-default" />
        <div className="mt-5 flex items-center gap-2">
          <span className="w-10 h-10 rounded-full animate-pulse bg-default" />
          <span className="w-20 h-[1rem] rounded-full animate-pulse bg-default" />
        </div>
      </header>
    </>
  );
};

export const ContentSkeletons = () => {
  return (
    <article className="flex flex-col gap-7 w-full">
      {/*banner*/}
      <span className="w-full h-[20rem] rounded-lg animate-pulse bg-default" />
      {/*content*/}
      <div className="flex flex-col gap-4 w-full">
        <span className="w-full h-[1rem] rounded-full animate-pulse bg-default" />
        <span className="w-full h-[1rem] rounded-full animate-pulse bg-default" />
        <span className="w-full h-[1rem] rounded-full animate-pulse bg-default" />
      </div>
    </article>
  );
};

export default function PostLoading() {
  return (
    <div className="flex flex-col h-screen w-full items-center justify-start">
      <MetaSkeletons />
      <ContentSkeletons />
    </div>
  );
}
