"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  Card,
  Skeleton,
  AlertDialog,
  Button,
  Separator,
  TextField,
  Input,
  Label,
  FieldError,
} from "@heroui/react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Trash2, Building2 } from "lucide-react";
import { toast } from "sonner";

import { orpc } from "@/libs/orpc/client";
import { useOrganizationStore } from "@/store/organization.store";

export const OrgSetting = () => {
  const router = useRouter();
  const [input, setInput] = useState("");
  const { currentOrgSlug } = useOrganizationStore((state) => state);
  const { data } = useQuery(
    orpc.organization.details.queryOptions({
      input: {
        slug: currentOrgSlug,
      },
    })
  );

  const { mutate } = useMutation(
    orpc.organization.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Organization deleted successfully");
        router.push("/onboarding");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    })
  );

  const handleDelete = () => {
    if (data?.id) {
      mutate({ id: data.id });
    }
  };

  return (
    <Card className="w-full">
      <Card.Header>
        <Card.Title className="flex items-center gap-2">
          <Building2 size={18} />
          Organization Settings
        </Card.Title>
        {data ? (
          <Card.Description className="flex items-center gap-2">
            <span>Organization Name:</span>
            {data.name}
          </Card.Description>
        ) : (
          <Skeleton className="h-5 w-32" />
        )}
      </Card.Header>
      <Separator />
      <Card.Content>
        <h4 className="text-danger">Danger Zone</h4>
        <AlertDialog>
          <div className="flex items-center justify-between">
            <p>Delete organization</p>
            <Button variant="danger">
              <Trash2 /> Delete
            </Button>
          </div>
          <AlertDialog.Backdrop>
            <AlertDialog.Container>
              <AlertDialog.Dialog className="sm:max-w-100">
                <AlertDialog.CloseTrigger />
                <AlertDialog.Header>
                  <AlertDialog.Icon status="danger" />
                  <AlertDialog.Heading>
                    Delete organization permanently?
                  </AlertDialog.Heading>
                </AlertDialog.Header>
                <AlertDialog.Body className="p-1">
                  <p>
                    This will permanently delete <strong>{data?.name}</strong>{" "}
                    and all of its data. This action cannot be undone.
                  </p>
                  <TextField
                    variant="secondary"
                    isRequired
                    className="mt-4"
                    onChange={setInput}
                    validate={(v) => {
                      if (v !== `delete ${data?.name}`) {
                        return "You must type the organization name to confirm deletion.";
                      }
                      return null;
                    }}>
                    <Label>
                      Please type <strong>delete {data?.name}</strong> to
                      confirm.
                    </Label>
                    <Input placeholder="Type organization name to confirm" />
                    <FieldError />
                  </TextField>
                </AlertDialog.Body>
                <AlertDialog.Footer>
                  <Button slot="close" variant="tertiary">
                    Cancel
                  </Button>
                  <Button
                    onPress={handleDelete}
                    variant="danger"
                    isDisabled={input !== `delete ${data?.name}`}>
                    Delete Organization
                  </Button>
                </AlertDialog.Footer>
              </AlertDialog.Dialog>
            </AlertDialog.Container>
          </AlertDialog.Backdrop>
        </AlertDialog>
      </Card.Content>
    </Card>
  );
};
