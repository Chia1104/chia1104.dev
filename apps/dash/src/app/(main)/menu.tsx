"use client";

import {
  Link,
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenu,
  NavbarMenuItem,
  Button,
  Avatar,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Tabs,
  Tab,
  NavbarMenuToggle,
} from "@nextui-org/react";
import { ToggleTheme, Image, useDarkMode } from "@chia/ui";
import { useSession } from "next-auth/react";
import { signInAction, signOutAction } from "@/server/auth.action";
import { useTransition, type Key, useState } from "react";
import { useRouter, useSelectedLayoutSegments } from "next/navigation";
import NextLink from "next/link";

const User = () => {
  const [isPending, startTransition] = useTransition();
  const { data: session, status } = useSession();
  return (
    <>
      {status === "unauthenticated" ? (
        <NavbarItem>
          <Button
            as={Link}
            color="primary"
            variant="flat"
            onPress={() => startTransition(() => signInAction())}>
            Sign Up
          </Button>
        </NavbarItem>
      ) : (
        <NavbarItem>
          <Dropdown>
            <DropdownTrigger>
              <Avatar
                isBordered
                as="button"
                className="transition-transform"
                color="secondary"
                size="sm"
                src={session?.user?.image ?? ""}
              />
            </DropdownTrigger>
            <DropdownMenu disabledKeys={isPending ? ["logout"] : undefined}>
              <DropdownItem
                key="logout"
                className="text-danger"
                color="danger"
                onPress={() => startTransition(() => signOutAction())}>
                Sign Out
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </NavbarItem>
      )}
    </>
  );
};

const Menu = () => {
  const { isDarkMode, toggle } = useDarkMode();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const selectedLayoutSegments = useSelectedLayoutSegments();
  const handlePush = (key: Key) => {
    switch (key) {
      case "dashboard":
        router.push("/");
        break;
      case "metrics":
        // router.push("/metrics");
        break;
      case "feed":
        router.push("/feed");
        break;
      case "write":
        router.push("/write");
        break;
      default:
        break;
    }
  };
  return (
    <Navbar
      isMenuOpen={isMenuOpen}
      onMenuOpenChange={setIsMenuOpen}
      position="sticky"
      maxWidth="full"
      isBordered={false}
      className="fixed border-0"
      shouldHideOnScroll>
      <NavbarContent>
        <NavbarBrand
          className="hidden cursor-pointer md:block"
          onClick={() => router.push("/")}>
          <Image
            src="/logo.png"
            alt="chia1104"
            width={50}
            height={50}
            blur={false}
          />
        </NavbarBrand>
        <NavbarMenuToggle
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          className="md:hidden"
        />
      </NavbarContent>
      <NavbarContent className="hidden md:flex" justify="center">
        <Tabs
          size="md"
          variant="solid"
          radius="lg"
          onSelectionChange={(key) => handlePush(key)}
          selectedKey={selectedLayoutSegments[0] ?? "dashboard"}>
          <Tab title="Dashboard" key="dashboard" />
          <Tab title="Metrics" key="metrics" />
          <Tab title="Feed" key="feed" />
          <Tab title="Write" key="write" />
        </Tabs>
      </NavbarContent>
      <NavbarContent justify="end">
        <User />
        <NavbarItem>
          <ToggleTheme isDark={isDarkMode} toggleTheme={toggle} />
        </NavbarItem>
      </NavbarContent>
      <NavbarMenu>
        <NavbarMenuItem>
          <NextLink
            className="text-primary w-full"
            href="/"
            onClick={() => setIsMenuOpen(false)}>
            Dashboard
          </NextLink>
        </NavbarMenuItem>
        <NavbarMenuItem>
          <NextLink
            className="text-primary w-full"
            href="/feed"
            onClick={() => setIsMenuOpen(false)}>
            Feed
          </NextLink>
        </NavbarMenuItem>
        <NavbarMenuItem>
          <NextLink
            className="text-primary w-full"
            href="/write"
            onClick={() => setIsMenuOpen(false)}>
            write
          </NextLink>
        </NavbarMenuItem>
      </NavbarMenu>
    </Navbar>
  );
};

export default Menu;
