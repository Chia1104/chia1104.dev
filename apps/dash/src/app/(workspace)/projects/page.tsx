"use client";

import { useRouter } from "next/navigation";
import { ViewTransition } from "react";

import { Spinner, Button } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import Card from "@/components/commons/card";
import { orpc } from "@/libs/orpc/client";
import { useOrganizationStore } from "@/store/organization.store";

const Page = () => {
  const { currentOrgId } = useOrganizationStore((state) => state);
  const router = useRouter();
  const { data, isLoading } = useQuery(
    orpc.organization.projects.list.queryOptions({
      input: {
        organizationId: currentOrgId,
        limit: 20,
      },
    })
  );
  if (isLoading) return <Spinner size="md" />;
  return (
    <ViewTransition>
      <section className="flex w-full flex-col gap-4 px-4 py-8 md:px-6 lg:px-8">
        <header className="flex w-full items-center justify-between">
          <h2 className="text-2xl font-bold">Projects</h2>
          <Button onPress={() => router.push("/projects/create")}>
            <Plus className="size-4" />
            Create Project
          </Button>
        </header>
        <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2">
          {data?.items.map((item) => (
            <Card
              key={item.id}
              title={item.name}
              description={item.slug}
              imageSrc={item.logo}
              onPress={() => router.push(`/projects/${item.slug}`)}
            />
          ))}
        </div>
      </section>
    </ViewTransition>
  );
};

export default Page;
