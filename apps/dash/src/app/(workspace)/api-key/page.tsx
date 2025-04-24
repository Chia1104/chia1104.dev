import { GlobalApiKeyTable } from "@/components/projects/api-key-table";

const Page = () => {
  return (
    <div className="w-full flex flex-col gap-5">
      <GlobalApiKeyTable
        query={{
          withProject: true,
        }}
      />
    </div>
  );
};

export default Page;
