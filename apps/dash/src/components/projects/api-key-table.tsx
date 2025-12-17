"use client";

import { useCallback, useMemo } from "react";

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
import { PencilIcon, Trash2Icon } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import type { RouterInputs, RouterOutputs } from "@chia/api";
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
import { truncateMiddle } from "@chia/utils/string";

import { api } from "@/trpc/client";

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

type ApiKeysWithoutProject = RouterOutputs["apiKey"]["getApiKeys"]["items"];

type ApiKeysWithProject =
  RouterOutputs["apiKey"]["getAllApiKeysWithMeta"]["items"];

type ApiKeys<TWithProject extends boolean = false> = TWithProject extends true
  ? ApiKeysWithProject
  : ApiKeysWithoutProject;

type Query = RouterInputs["apiKey"]["getApiKeys"];

type AllKeysQuery = RouterInputs["apiKey"]["getAllApiKeysWithMeta"];

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
  const utils = api.useUtils();
  const form = useForm({
    resolver: zodResolver(
      z.object({
        name: z.string().min(1),
      })
    ),
  });
  const { mutate, isPending, isSuccess, data } =
    api.apiKey.createAPIKey.useMutation({
      onSuccess: async (data) => {
        if (data) {
          toast.success("API Key created successfully");
          await utils.apiKey.invalidate();
        }
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
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
          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5">
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
            <SubmitForm isLoading={isPending}>Create</SubmitForm>
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
    <div className="w-full flex flex-col gap-5">
      <div className="flex gap-5 justify-between">
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
  } = api.apiKey.getApiKeys.useInfiniteQuery(
    {
      ...props.query,
      projectId: props.projectId,
    },
    {
      getNextPageParam: (lastPage) => lastPage?.nextCursor,
      initialData: props.initApiKey
        ? {
            pages: [
              {
                items: props.initApiKey,
                nextCursor: props.nextCursor?.toString() ?? null,
              },
            ],
            pageParams: [props.nextCursor?.toString()],
          }
        : undefined,
    }
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
  } = api.apiKey.getAllApiKeysWithMeta.useInfiniteQuery(props.query ?? {}, {
    getNextPageParam: (lastPage) => lastPage?.nextCursor,
    initialData: props.initApiKey
      ? {
          pages: [
            {
              items: props.initApiKey,
              nextCursor: props.nextCursor?.toString(),
            },
          ],
          pageParams: [props.nextCursor?.toString()],
        }
      : undefined,
  });

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
