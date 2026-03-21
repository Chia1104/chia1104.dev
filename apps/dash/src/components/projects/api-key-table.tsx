"use client";

import { useCallback, useMemo, useId } from "react";

import {
  Button,
  Modal,
  Input,
  Form,
  TextField,
  FieldError,
  Label,
  Surface,
  Table,
  Spinner,
} from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { CopyButton } from "@chia/ui/copy-button";
import DateFormat from "@chia/ui/date-format";
import SubmitForm from "@chia/ui/submit-form";
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

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

type CreateFormData = z.infer<typeof createSchema>;

const ApiKeyDisplay = ({ apiKey }: { apiKey: string }) => {
  return (
    <Surface
      className="flex items-center justify-between rounded-lg p-3 font-mono text-sm"
      variant="secondary">
      <span>
        {truncateMiddle(apiKey, apiKey.length / 2, {
          frontLength: 8,
          backLength: 8,
          ellipsis: "...",
        })}
      </span>
      <CopyButton
        content={apiKey}
        translations={{
          copied: "Copied",
          copy: "Copy",
        }}
      />
    </Surface>
  );
};

const CreateForm = (props: { projectId?: number; onSuccess?: () => void }) => {
  const queryClient = useQueryClient();
  const formId = useId();
  const form = useForm<CreateFormData>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: "",
    },
  });

  const { mutate, isPending, isSuccess, data } = useMutation(
    orpc.apikey.create.mutationOptions({
      onSuccess: async (data) => {
        if (data) {
          toast.success("API Key created successfully");
          queryClient.invalidateQueries(
            orpc.apikey.list.queryOptions({
              input: {
                projectId: props.projectId,
              },
            })
          );
          props.onSuccess?.();
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
      {isSuccess && data?.key ? (
        <div className="flex flex-col gap-3">
          <p className="text-foreground/70 text-sm">
            Save your API key now - you won't be able to see it again!
          </p>
          <ApiKeyDisplay apiKey={data.key} />
        </div>
      ) : (
        <Form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
          <Controller
            control={form.control}
            name="name"
            render={({ field, fieldState: { invalid, error } }) => (
              <TextField isInvalid={invalid} isRequired variant="secondary">
                <Label htmlFor={`${formId}-name`}>API Key Name</Label>
                <Input
                  id={`${formId}-name`}
                  placeholder="Enter your API Key name"
                  {...field}
                />
                <FieldError>{error?.message}</FieldError>
              </TextField>
            )}
          />
          <SubmitForm isPending={isPending}>Create</SubmitForm>
        </Form>
      )}
    </>
  );
};

const CreateAction = (props: { projectId?: number }) => {
  const queryClient = useQueryClient();

  const handleSuccess = () => {
    queryClient.invalidateQueries(
      orpc.apikey.list.queryOptions({
        input: {
          projectId: props.projectId,
        },
      })
    );
  };

  return (
    <Modal>
      <Button variant="primary" className="min-w-32.5">
        Add API Key
      </Button>
      <Modal.Backdrop>
        <Modal.Container placement="auto">
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Create New API Key</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="p-4">
              <CreateForm
                projectId={props.projectId}
                onSuccess={handleSuccess}
              />
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
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
  const renderCell = useCallback(
    (item: ApiKeys<TWithProject>[0], key: string) => {
      switch (key) {
        case "name":
          return (
            <div className="flex flex-col">
              <p className="text-sm font-semibold">{item.name}</p>
            </div>
          );
        case "createdAt":
          return (
            <div className="flex flex-col">
              <span className="text-sm font-semibold">
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
              <Button
                isIconOnly
                variant="ghost"
                size="sm"
                aria-label="Edit API Key">
                <PencilIcon size={16} />
              </Button>
              <Button
                isIconOnly
                variant="danger"
                size="sm"
                aria-label="Delete API Key">
                <Trash2Icon size={16} />
              </Button>
            </div>
          );
        case "project":
          return withProject ? (
            <div className="flex flex-col">
              {/* @ts-expect-error - TODO: Fix the type issue */}
              <p className="text-sm font-semibold">{item?.project?.name}</p>
            </div>
          ) : null;
        default:
          return null;
      }
    },
    [withProject]
  );

  const currentHeaders = withProject ? headersWithProject : headers;

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex items-center justify-between gap-5">
        <h3 className="text-lg font-bold">API Keys</h3>
        <CreateAction projectId={projectId} />
      </div>

      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="API Keys">
            <Table.Header>
              {currentHeaders.map((column) => (
                <Table.Column
                  key={column.uid}
                  id={column.uid}
                  isRowHeader={column.uid === "name"}>
                  {column.name}
                </Table.Column>
              ))}
            </Table.Header>
            <Table.Body
              renderEmptyState={() => (
                <div className="text-foreground/70 py-4 text-center text-sm">
                  {isLoading ? "Loading..." : "No API Keys found"}
                </div>
              )}>
              <Table.Collection items={data}>
                {(item) => (
                  <Table.Row id={item.id}>
                    {currentHeaders.map((column) => (
                      <Table.Cell key={column.uid}>
                        {renderCell(item, column.uid)}
                      </Table.Cell>
                    ))}
                  </Table.Row>
                )}
              </Table.Collection>
              {hasNextPage && (
                <Table.LoadMore
                  isLoading={isLoading}
                  scrollOffset={0}
                  onLoadMore={onLoadMore}>
                  <Table.LoadMoreContent>
                    <Spinner size="sm" />
                  </Table.LoadMoreContent>
                </Table.LoadMore>
              )}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
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
      getNextPageParam: (lastPage: { nextCursor?: string | number | null }) =>
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
      getNextPageParam: (lastPage: { nextCursor?: string | number | null }) =>
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
