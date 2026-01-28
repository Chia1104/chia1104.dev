import { GlobalApiKeyTable } from "@/components/projects/api-key-table";

const Page = () => {
  return (
    <div className="flex w-full flex-col gap-5">
      <GlobalApiKeyTable
        query={{
          withProject: true,
        }}
      />
    </div>
  );
};

export default Page;
