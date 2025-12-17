"use client";

import { useCallback, useTransition } from "react";

import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Spinner,
  Button,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerContent,
  DrawerFooter,
  Input,
  useDisclosure,
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { authClient } from "@chia/auth/client";
import type { Passkey } from "@chia/db/schema";
import DateFormat from "@chia/ui/date-format";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  Form,
} from "@chia/ui/form";
import SubmitForm from "@chia/ui/submit-form";
import { truncateMiddle } from "@chia/utils/string";

const headers = [
  { name: "Name", uid: "name" },
  { name: "Device", uid: "deviceType" },
  { name: "Created At", uid: "createdAt" },
  { name: "Action", uid: "publicKey" },
];

const UpdateAction = (props: { item: Passkey; onSuccess?: () => void }) => {
  const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure();

  const form = useForm({
    defaultValues: {
      name: props.item.name ?? "",
    },
    resolver: zodResolver(
      z.object({
        name: z.string().min(1),
      })
    ),
  });

  const onSubmit = form.handleSubmit((values) => {
    void authClient.passkey.updatePasskey(
      {
        id: props.item.id,
        name: values.name,
      },
      {
        onError: () => {
          toast.error("Failed to update passkey");
        },
        onSuccess: () => {
          toast.success("Passkey updated successfully");
          props.onSuccess?.();
          onClose();
        },
      }
    );
  });

  return (
    <>
      <Button isIconOnly variant="flat" onPress={onOpen}>
        <PencilIcon size={16} />
      </Button>
      <Drawer isOpen={isOpen} onOpenChange={onOpenChange}>
        <DrawerContent>
          {(onClose) => (
            <Form {...form}>
              <form onSubmit={onSubmit}>
                <DrawerHeader className="flex flex-col gap-1">
                  Passkey: {props.item.name}
                </DrawerHeader>
                <DrawerBody>
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            label="Name"
                            placeholder="Enter your passkey name"
                            variant="bordered"
                            isInvalid={fieldState.invalid}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </DrawerBody>
                <DrawerFooter>
                  <Button color="danger" variant="flat" onPress={onClose}>
                    Close
                  </Button>
                  <SubmitForm color="primary" type="submit">
                    Update
                  </SubmitForm>
                </DrawerFooter>
              </form>
            </Form>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
};

const DeleteAction = (props: { item: Passkey; onSuccess?: () => void }) => {
  const [isPending, startTransition] = useTransition();

  const handleDelete = useCallback(async () => {
    await authClient.passkey.deletePasskey(
      { id: props.item.id },
      {
        onError: () => {
          toast.error("Failed to delete passkey");
        },
        onSuccess: () => {
          toast.success("Passkey deleted successfully");
          props.onSuccess?.();
        },
      }
    );
  }, [props]);

  return (
    <Popover>
      <PopoverTrigger>
        <Button isIconOnly color="danger" variant="flat">
          <Trash2Icon size={16} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-4 gap-3">
        <div className="text-small font-bold">
          Are you sure you want to delete this passkey?
        </div>
        <Button
          isLoading={isPending}
          color="danger"
          variant="flat"
          onPress={() => startTransition(() => handleDelete())}>
          Delete
        </Button>
      </PopoverContent>
    </Popover>
  );
};

const PasskeyForm = () => {
  const { data, isPending, refetch } = authClient.useListPasskeys();

  const handleAddPasskey = useCallback(() => {
    void authClient.passkey.addPasskey({
      name: "Chia1104.dev",
    });
  }, []);

  const renderCell = useCallback(
    (item: Passkey, key: keyof Passkey) => {
      switch (key) {
        case "name":
          return (
            <div className="flex flex-col">
              <p className="text-bold text-sm capitalize">{item.name}</p>
              <p className="text-bold text-sm capitalize text-default-400">
                {truncateMiddle(item.publicKey, item.publicKey.length / 2, {
                  frontLength: 4,
                  backLength: 4,
                  ellipsis: "********",
                })}
              </p>
            </div>
          );
        case "deviceType":
          return (
            <div className="flex flex-col">
              <p className="text-bold text-sm capitalize">{item.deviceType}</p>
            </div>
          );
        case "createdAt":
          return (
            <div className="flex flex-col">
              <span className="text-bold text-sm capitalize">
                <DateFormat
                  date={item.createdAt}
                  format="YYYY-MM-DD HH:mm:ss"
                />
              </span>
            </div>
          );
        case "publicKey":
          return (
            <div className="flex gap-2">
              <UpdateAction item={item} onSuccess={refetch} />
              <DeleteAction item={item} onSuccess={refetch} />
            </div>
          );
        default:
          return null;
      }
    },
    [refetch]
  );

  return (
    <div className="w-full flex flex-col gap-5">
      <div className="flex gap-5 justify-between">
        <p className="text-sm text-default-400">
          Passkeys are webauthn credentials that validate your identity using
          touch, facial recognition, a device password, or a PIN. They can be
          used as a password replacement or as a 2FA method.
        </p>
        <Button className="min-w-[130px]" onPress={handleAddPasskey}>
          Add Passkey
        </Button>
      </div>
      <Table aria-label="Example table with custom cells">
        <TableHeader columns={headers}>
          {(column) => (
            <TableColumn key={column.uid}>{column.name}</TableColumn>
          )}
        </TableHeader>
        <TableBody
          items={data ?? []}
          emptyContent={isPending ? <Spinner /> : "No Passkey data"}>
          {(item) => (
            <TableRow key={item.id}>
              {(columnKey) => (
                <TableCell>
                  {renderCell(item as Passkey, columnKey as keyof Passkey)}
                </TableCell>
              )}
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default PasskeyForm;
