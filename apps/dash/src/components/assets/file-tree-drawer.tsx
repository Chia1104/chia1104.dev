"use client";

import type { ReactNode } from "react";

import { Drawer, Input, TextField } from "@heroui/react";
import { Search } from "lucide-react";

interface FileTreeDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  search: string;
  onSearchChange: (value: string) => void;
  children: ReactNode;
}

export const FileTreeDrawer = ({
  isOpen,
  onOpenChange,
  search,
  onSearchChange,
  children,
}: FileTreeDrawerProps) => {
  return (
    <Drawer.Backdrop
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className="md:hidden">
      <Drawer.Content placement="bottom">
        <Drawer.Dialog>
          <Drawer.Handle />
          <Drawer.CloseTrigger />
          <Drawer.Header>
            <Drawer.Heading>Files</Drawer.Heading>
          </Drawer.Header>
          <Drawer.Body>
            <TextField
              aria-label="Search files"
              value={search}
              onChange={onSearchChange}
              fullWidth
              className="relative mb-3">
              <div className="relative">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 z-10 size-3.5 -translate-y-1/2" />
                <Input placeholder="Search files..." className="pl-8" />
              </div>
            </TextField>
            {children}
          </Drawer.Body>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
};
