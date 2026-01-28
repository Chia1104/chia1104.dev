"use client";

import { useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";

import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Spinner,
  Button,
  Snippet,
  useDisclosure,
  Modal,
  ModalBody,
  ModalHeader,
  ModalContent,
  ModalFooter,
  Input,
} from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import * as z from "zod";

import DateFormat from "@chia/ui/date-format";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  Form,
} from "@chia/ui/form";
import SubmitForm from "@chia/ui/submit-form";
import useInfiniteScroll from "@chia/ui/utils/use-infinite-scroll";
import { truncateMiddle } from "@chia/utils/format";

import { orpc } from "@/libs/orpc/client";
import type { RouterOutputs, RouterInputs } from "@/libs/orpc/types";

const headersWithProject = [
  { name: "Name", uid: "name" },
  { name: "Created At", uid: "createdAt" },
  { name: "Project", uid: "project" },
  { name: "Action", uid: "id" },
];

const headers = [
  { name: "Name", uid: "name" },
  { name: "Created At", uid: "createdAt" },
  { name: "Action", uid: "id" },
];

type ApiKeysWithoutProject = RouterOutputs["apikey"]["list"]["items"];

type ApiKeysWithProject = RouterOutputs["apikey"]["list"]["items"];

type ApiKeys<TWithProject extends boolean = false> = TWithProject extends true
  ? ApiKeysWithProject
  : ApiKeysWithoutProject;

type Query = RouterInputs["apikey"]["list"];

type AllKeysQuery = RouterInputs["apikey"]["list"];

interface Props {
  initApiKey?: ApiKeysWithoutProject;
  nextCursor?: string | number | null;
  projectId: number;
  query?: Partial<Query>;
}

interface AllKeysProps {
  initApiKey?: ApiKeysWithProject;
  nextCursor?: string | number | null;
  query?: Partial<AllKeysQuery>;
}

const CreateForm = (props: { projectId?: number }) => {
  const queryClient = useQueryClient();
  const form = useForm({
    resolver: zodResolver(
      z.object({
        name: z.string().min(1),
      })
    ),
  });
  const { mutate, isPending, isSuccess, data } = useMutation(
    orpc.apikey.create.mutationOptions({
      onSuccess: async (data) => {
        if (data) {
          toast.success("API Key created successfully");
          await queryClient.invalidateQueries(
            orpc.apikey.list.queryOptions({
              input: {
                projectId: props.projectId,
              },
            })
          );
        }
      },
      onError: (error) => {
        toast.error(error.message);
      },
    })
  );
  const handleSubmit = form.handleSubmit((data) => {
    mutate({
      name: data.name,
      projectId: props.projectId,
    });
  });
  return (
    <>
      {isSuccess ? (
        <Snippet codeString={data.key}>
          {truncateMiddle(data.key, data.key.length / 2, {
            frontLength: 4,
            backLength: 4,
            ellipsis: "********",
          })}
        </Snippet>
      ) : (
        <Form {...form}>
          <form onSubmit={handleSubmit} className="flex w-full flex-col gap-5">
            <FormField
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      label="Name"
                      labelPlacement="outside"
                      placeholder="Enter your ApiKey name"
                      isInvalid={fieldState.invalid}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <SubmitForm isPending={isPending}>Create</SubmitForm>
          </form>
        </Form>
      )}
    </>
  );
};

const CreateAction = (props: { projectId?: number }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  return (
    <>
      <Button className="min-w-[130px]" onPress={onOpen}>
        Add ApiKey
      </Button>
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                Create New ApiKey
              </ModalHeader>
              <ModalBody>
                <CreateForm projectId={props.projectId} />
              </ModalBody>
              <ModalFooter>
                <Button color="primary" variant="flat" onPress={onClose}>
                  Close
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
};

export const ApiKeyTablePrimitive = <TWithProject extends boolean = false>({
  data,
  hasNextPage,
  isLoading,
  onLoadMore,
  projectId,
  withProject,
}: {
  data: ApiKeys<TWithProject>;
  hasNextPage?: boolean;
  isLoading?: boolean;
  onLoadMore?: () => void;
  projectId?: number;
  withProject?: TWithProject;
}) => {
  const { ref } = useInfiniteScroll<HTMLDivElement>({
    hasMore: hasNextPage,
    isLoading,
    onLoadMore,
  });

  const renderCell = useCallback(
    (item: ApiKeys<TWithProject>[0], key: keyof ApiKeys<TWithProject>[0]) => {
      switch (key) {
        case "name":
          return (
            <div className="flex flex-col">
              <p className="text-bold text-sm">{item.name}</p>
            </div>
          );
        case "createdAt":
          return (
            <div className="flex flex-col">
              <span className="text-bold text-sm">
                <DateFormat
                  date={item.createdAt}
                  format="YYYY-MM-DD HH:mm:ss"
                />
              </span>
            </div>
          );
        case "id":
          return (
            <div className="flex gap-2">
              <Button isIconOnly variant="flat">
                <PencilIcon size={16} />
              </Button>
              <Button isIconOnly color="danger" variant="flat">
                <Trash2Icon size={16} />
              </Button>
            </div>
          );
        case "project":
          return withProject ? (
            <div className="flex flex-col">
              {/* @ts-expect-error - TODO: Fix the type issue */}
              <p className="text-bold text-sm">{item?.project?.name}</p>
            </div>
          ) : null;
        default:
          return null;
      }
    },
    [withProject]
  );

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex justify-between gap-5">
        <h3 className="text-lg font-bold">ApiKey</h3>
        <CreateAction projectId={projectId} />
      </div>
      <Table
        bottomContent={
          hasNextPage ? (
            <div className="flex w-full justify-center">
              <Spinner ref={ref} />
            </div>
          ) : null
        }
        aria-label="ApiKey table ">
        <TableHeader columns={withProject ? headersWithProject : headers}>
          {(column) => (
            <TableColumn key={column.uid}>{column.name}</TableColumn>
          )}
        </TableHeader>
        <TableBody
          isLoading={isLoading}
          loadingContent={<Spinner />}
          items={data}
          emptyContent={isLoading ? <Spinner /> : "No ApiKey data"}>
          {(item) => (
            <TableRow key={item.id}>
              {(columnKey) => (
                <TableCell>
                  {renderCell(item, columnKey as keyof ApiKeys[0])}
                </TableCell>
              )}
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

const ApiKeyTable = (props: Props) => {
  const {
    data,
    isSuccess,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery(
    orpc.apikey["project-list"].infiniteOptions({
      input: (pageParam) => ({
        ...props.query,
        projectId: props.projectId,
        cursor: pageParam,
      }),
      getNextPageParam: (lastPage) =>
        lastPage?.nextCursor ? lastPage.nextCursor.toString() : null,
      initialData: props.initApiKey
        ? {
            pages: [
              {
                items: props.initApiKey,
                nextCursor: props.nextCursor?.toString() ?? null,
              },
            ],
            pageParams: [props.nextCursor?.toString() ?? null],
          }
        : undefined,
      initialPageParam: props.nextCursor?.toString() ?? null,
    })
  );

  const flatData = useMemo(() => {
    if (!isSuccess || !data) return [];
    return data.pages.flatMap((page) => page.items);
  }, [data, isSuccess]);

  return (
    <ApiKeyTablePrimitive
      data={flatData}
      hasNextPage={hasNextPage}
      isLoading={isLoading || isFetchingNextPage}
      onLoadMore={() => fetchNextPage()}
      projectId={props.projectId}
    />
  );
};

export const GlobalApiKeyTable = (props: AllKeysProps) => {
  const {
    data,
    isSuccess,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery(
    orpc.apikey.list.infiniteOptions({
      input: (pageParam) => ({
        ...props.query,
        cursor: pageParam,
      }),
      getNextPageParam: (lastPage) =>
        lastPage?.nextCursor ? lastPage.nextCursor.toString() : null,
      initialData: props.initApiKey
        ? {
            pages: [
              {
                items: props.initApiKey,
                nextCursor: props.nextCursor?.toString() ?? null,
              },
            ],
            pageParams: [props.nextCursor?.toString() ?? null],
          }
        : undefined,
      initialPageParam: props.nextCursor?.toString() ?? null,
    })
  );

  const flatData = useMemo(() => {
    if (!isSuccess || !data) return [];
    return data.pages.flatMap((page) => page.items);
  }, [data, isSuccess]);

  return (
    <ApiKeyTablePrimitive
      data={flatData}
      hasNextPage={hasNextPage}
      isLoading={isLoading || isFetchingNextPage}
      onLoadMore={() => fetchNextPage()}
      withProject={props.query?.withProject}
    />
  );
};

export default ApiKeyTable;
