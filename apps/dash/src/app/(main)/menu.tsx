"use client";

import {
  Link,
  Navbar,
  NavbarContent,
  NavbarItem,
  Button,
  Avatar,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@nextui-org/react";
import { signInAction } from "@/server/auth.action";
import { useTransition, useState } from "react";
import AuthGuard from "@/components/auth-guard/index.client";
import { signOut } from "next-auth/react";

const User = () => {
  const [isPending, startTransition] = useTransition();
  return (
    <AuthGuard
      fallback={
        <NavbarItem>
          <Button
            as={Link}
            color="primary"
            variant="flat"
            isDisabled={isPending}
            onPress={() => startTransition(() => signInAction())}>
            Sign In
          </Button>
        </NavbarItem>
      }>
      {(session) => (
        <NavbarItem>
          <Dropdown>
            <DropdownTrigger>
              <Avatar
                isBordered
                as="button"
                className="transition-transform"
                color="secondary"
                size="sm"
                src={session.user?.image ?? ""}
              />
            </DropdownTrigger>
            <DropdownMenu disabledKeys={isPending ? ["logout"] : undefined}>
              <DropdownItem
                key="logout"
                className="text-danger"
                color="danger"
                onPress={() => startTransition(() => signOut())}>
                Sign Out
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </NavbarItem>
      )}
    </AuthGuard>
  );
};

const Menu = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  return (
    <Navbar
      isMenuOpen={isMenuOpen}
      onMenuOpenChange={setIsMenuOpen}
      position="sticky"
      maxWidth="full"
      isBordered={false}
      className="fixed z-20 border-0"
      shouldHideOnScroll>
      <NavbarContent justify="end">
        <User />
      </NavbarContent>
    </Navbar>
  );
};

export default Menu;
