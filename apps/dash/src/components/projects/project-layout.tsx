"use client";

import type { ReactNode } from "react";

import {
  Card,
  Modal,
  ModalHeader,
  ModalContent,
  ModalBody,
  ModalFooter,
  Button,
  useDisclosure,
} from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import { useSelectedLayoutSegments } from "next/navigation";

import { cn } from "@chia/ui/utils/cn.util";

import { orpc } from "@/libs/orpc/client";
import { useOrganizationStore } from "@/store/organization.store";

import CreateForm from "./create-form";

const Create = () => {
  const queryClient = useQueryClient();
  const { isOpen, onOpen, onOpenChange } = useDisclosure({
    id: "create-modal",
  });
  const { currentOrgId } = useOrganizationStore((state) => state);

  return (
    <>
      <Button
        aria-label="Create New Project"
        onPress={onOpen}
        className="w-fit"
        variant="flat"
        size="sm">
        Create New Project
      </Button>
      <Modal isOpen={isOpen} onClose={onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                Create New Project
              </ModalHeader>
              <ModalBody>
                <Card>
                  <CreateForm
                    organizationId={currentOrgId}
                    onSuccess={async () => {
                      onClose();
                      await queryClient.invalidateQueries(
                        orpc.organization.projects.list.queryOptions({
                          input: {
                            organizationId: currentOrgId,
                          },
                        })
                      );
                    }}
                  />
                </Card>
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

const ProjectLayout = ({ children }: { children: ReactNode }) => {
  const { currentOrgSlug } = useOrganizationStore((state) => state);
  const segments = useSelectedLayoutSegments();

  return (
    <>
      <nav className="w-full h-20 c-bg-third absolute inset-0 flex items-center justify-between px-10">
        <h2 className="text-xl font-bold">
          {currentOrgSlug}
          {segments.length > 0 ? ` / ${segments[0]}` : ""}
        </h2>
        <Create />
      </nav>
      <section className={cn("container main justify-start items-start mt-10")}>
        {children}
      </section>
    </>
  );
};

export default ProjectLayout;
