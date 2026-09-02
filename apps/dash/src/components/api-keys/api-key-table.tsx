"use client";

import { useCallback, useMemo, useId, useState } from "react";

import {
  AlertDialog,
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

const headers = [
  { name: "Name", uid: "name" },
  { name: "Created At", uid: "createdAt" },
  { name: "Action", uid: "id" },
];

type ApiKeys = RouterOutputs["apikey"]["list"]["items"];
type Query = RouterInputs["apikey"]["list"];

interface Props {
  initApiKey?: ApiKeys;
  nextCursor?: string | number | null;
  query?: Partial<Query>;
}

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

type CreateFormData = z.infer<typeof createSchema>;

const editSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

type EditFormData = z.infer<typeof editSchema>;

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

const CreateForm = (props: { onSuccess?: () => void }) => {
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
          queryClient.invalidateQueries({ queryKey: orpc.apikey.key() });
          props.onSuccess?.();
        }
      },
      onError: (error) => {
        toast.error(error.message);
      },
    })
  );

  const handleSubmit = form.handleSubmit((data) => {
    mutate({ name: data.name });
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

const CreateAction = () => {
  const queryClient = useQueryClient();

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: orpc.apikey.key() });
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
              <CreateForm onSuccess={handleSuccess} />
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};

const EditAction = ({ item }: { item: ApiKeys[0] }) => {
  const queryClient = useQueryClient();
  const formId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const form = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: item.name ?? "" },
  });

  const { mutate, isPending } = useMutation(
    orpc.apikey.update.mutationOptions({
      onSuccess: async () => {
        toast.success("API Key updated successfully");
        await queryClient.invalidateQueries({ queryKey: orpc.apikey.key() });
        setIsOpen(false);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    })
  );

  const open = () => {
    form.reset({ name: item.name ?? "" });
    setIsOpen(true);
  };

  const handleSubmit = form.handleSubmit((data) => {
    mutate({ keyId: item.id, name: data.name });
  });

  return (
    <>
      <Button
        isIconOnly
        variant="ghost"
        size="sm"
        aria-label="Edit API Key"
        onPress={open}>
        <PencilIcon size={16} />
      </Button>
      <Modal>
        <Modal.Backdrop isOpen={isOpen} onOpenChange={setIsOpen}>
          <Modal.Container placement="auto">
            <Modal.Dialog className="sm:max-w-md">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Edit API Key</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="p-4">
                <Form
                  onSubmit={handleSubmit}
                  className="flex w-full flex-col gap-4">
                  <Controller
                    control={form.control}
                    name="name"
                    render={({ field, fieldState: { invalid, error } }) => (
                      <TextField
                        isInvalid={invalid}
                        isRequired
                        variant="secondary">
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
                  <SubmitForm isPending={isPending}>Save</SubmitForm>
                </Form>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
};

const DeleteAction = ({ item }: { item: ApiKeys[0] }) => {
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation(
    orpc.apikey.delete.mutationOptions({
      onSuccess: async () => {
        toast.success("API Key deleted successfully");
        await queryClient.invalidateQueries({ queryKey: orpc.apikey.key() });
      },
      onError: (error) => {
        toast.error(error.message);
      },
    })
  );

  return (
    <AlertDialog>
      <Button isIconOnly variant="danger" size="sm" aria-label="Delete API Key">
        <Trash2Icon size={16} />
      </Button>
      <AlertDialog.Backdrop>
        {(action) => (
          <AlertDialog.Container>
            <AlertDialog.Dialog className="sm:max-w-[400px]">
              <AlertDialog.CloseTrigger />
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger" />
                <AlertDialog.Heading>Delete API key?</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p>
                  <span className="font-semibold">{item.name}</span> will stop
                  working immediately. This action cannot be undone.
                </p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button slot="close" variant="tertiary" isDisabled={isPending}>
                  Cancel
                </Button>
                <Button
                  onPress={() =>
                    mutate(item.id, {
                      onSuccess: () => action.state.close(),
                    })
                  }
                  isDisabled={isPending}
                  isPending={isPending}
                  variant="danger">
                  Delete
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        )}
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
};

export const ApiKeyTablePrimitive = ({
  data,
  hasNextPage,
  isLoading,
  onLoadMore,
}: {
  data: ApiKeys;
  hasNextPage?: boolean;
  isLoading?: boolean;
  onLoadMore?: () => void;
}) => {
  const renderCell = useCallback((item: ApiKeys[0], key: string) => {
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
              <DateFormat date={item.createdAt} format="YYYY-MM-DD HH:mm:ss" />
            </span>
          </div>
        );
      case "id":
        return (
          <div className="flex gap-2">
            <EditAction item={item} />
            <DeleteAction item={item} />
          </div>
        );
      default:
        return null;
    }
  }, []);

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex items-center justify-between gap-5">
        <h3 className="text-lg font-bold">API Keys</h3>
        <CreateAction />
      </div>

      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="API Keys">
            <Table.Header>
              {headers.map((column) => (
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
                    {headers.map((column) => (
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

export const ApiKeyTable = (props: Props) => {
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
    />
  );
};
