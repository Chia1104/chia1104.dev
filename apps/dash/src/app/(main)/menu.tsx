"use client";

import {
  Link,
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  Button,
  Avatar,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Tabs,
  TabItem,
} from "@nextui-org/react";
import { ToggleTheme, Image } from "ui";
import { useDarkMode } from "@/hooks";
import { useSession } from "next-auth/react";
import { signIn, signOut } from "next-auth/react";
import { useTransition } from "react";
import { useRouter, useSelectedLayoutSegments } from "next/navigation";

const User = () => {
  const [isPedding, startTransition] = useTransition();
  const { data: session, status } = useSession();
  return (
    <>
      {status === "unauthenticated" ? (
        <NavbarItem>
          <Button
            as={Link}
            color="primary"
            variant="flat"
            onPress={() =>
              signIn("google", {
                redirect: true,
                callbackUrl: "/",
              })
            }>
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
            <DropdownMenu disabledKeys={isPedding ? ["logout"] : undefined}>
              <DropdownItem
                key="logout"
                className="text-danger"
                color="danger"
                onPress={() =>
                  startTransition(() => {
                    signOut();
                  })
                }>
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
  const selectedLayoutSegments = useSelectedLayoutSegments();
  return (
    <Navbar
      position="floating"
      maxWidth="full"
      isBordered={false}
      className="fixed dark:border-0"
      shouldHideOnScroll>
      <NavbarBrand className="cursor-pointer" onClick={() => router.push("/")}>
        <Image
          src="/logo.png"
          alt="chia1104"
          width={50}
          height={50}
          blur={false}
        />
      </NavbarBrand>
      <NavbarContent className="hidden md:flex" justify="center">
        <Tabs
          size="md"
          variant="solid"
          radius="lg"
          selectedKey={selectedLayoutSegments[0] ?? "dashboard"}>
          <TabItem
            title="Dashboard"
            key="dashboard"
            onClick={() => router.push("/")}
          />
          <TabItem title="Metrics" key="metrics" />
          <TabItem
            title="Feed"
            key="feed"
            onClick={() => router.push("/feed")}
          />
          <TabItem
            title="Write"
            key="write"
            onClick={() => router.push("/write")}
          />
        </Tabs>
      </NavbarContent>
      <NavbarContent justify="end">
        <User />
        <NavbarItem>
          <ToggleTheme isDark={isDarkMode} toggleTheme={toggle} />
        </NavbarItem>
      </NavbarContent>
    </Navbar>
  );
};

export default Menu;
