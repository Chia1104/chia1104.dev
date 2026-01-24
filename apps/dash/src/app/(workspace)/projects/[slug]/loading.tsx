import AppLoading from "@/components/commons/app-loading";

const Loading = () => {
  return (
    <div className="flex min-h-[calc(100vh-75px)] w-full flex-col items-center justify-start">
      <AppLoading />
    </div>
  );
};

export default Loading;
