"use client";

import React from "react";

import {
  Avatar,
  Button,
  Spacer,
  Tooltip,
  useDisclosure,
  Skeleton,
  CircularProgress,
  Navbar,
  Breadcrumbs,
  BreadcrumbItem,
  ScrollShadow,
  Tabs,
  Tab,
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@heroui/react";
import { cn } from "@heroui/react";
import { Icon } from "@iconify/react";
import _ from "lodash";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useMediaQuery } from "usehooks-ts";

import { authClient } from "@chia/auth/client";

import { AcmeIcon } from "@/components/commons/acme";
import AuthGuard from "@/components/commons/auth-guard";
import Drawer from "@/components/commons/drawer";
import Footer from "@/components/commons/footer";
import SideBar from "@/components/commons/side-bar";
import { routeItems } from "@/shared/routes";

interface Props {
  children?: React.ReactNode;
}

const DashLayout = (props: Props) => {
  const { isOpen, onOpenChange } = useDisclosure();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const pathname = usePathname();
  const [isPending, startTransition] = React.useTransition();

  const router = useRouter();

  const currentItem = React.useMemo(() => {
    return routeItems.find(
      (item) => item.href === pathname || _.some(item.items, { href: pathname })
    );
  }, [pathname]);

  const onToggle = React.useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const generateBreadcrumbs = React.useCallback(() => {
    const segments = pathname.split("/").filter(Boolean); // Split and filter out empty values

    const breadcrumbs = [];
    let currentItems = routeItems; // Start with root routes
    let currentPath = ""; // Keep track of the full path

    for (const segment of segments) {
      const matchedItem = currentItems.find(
        (item) => item.key === segment || item.href === `/${segment}`
      );
      if (matchedItem) {
        const crumbPath = currentPath + matchedItem.href; // Build the full path for the breadcrumb
        breadcrumbs.push({
          title: matchedItem.title,
          href: crumbPath,
        });

        // If the matched item has children, navigate into them
        if (matchedItem.items) {
          currentItems = matchedItem.items;
        } else {
          currentItems = [];
        }

        currentPath = crumbPath; // Update the current path
      } else {
        break; // Stop if no matching route is found
      }
    }

    return breadcrumbs;
  }, [pathname]);

  const breadcrumbs = generateBreadcrumbs();

  return (
    <div className="flex h-dvh w-full">
      {/* Sidebar */}
      <Drawer
        className={cn("min-w-[288px] rounded-lg z-50", {
          "min-w-[76px]": isCollapsed,
        })}
        hideCloseButton={true}
        isOpen={isOpen}
        onOpenChange={onOpenChange}>
        <div
          className={cn(
            "will-change flex h-full w-72 flex-col bg-default-100 p-6 transition-width fixed top-0 z-10",
            {
              "w-[83px] items-center px-[6px] py-6": isCollapsed,
            }
          )}>
          <div
            className={cn("flex items-center gap-3 pl-2", {
              "justify-center gap-0 pl-0": isCollapsed,
            })}>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground">
              <AcmeIcon className="text-background" />
            </div>
            <span
              className={cn(
                "w-full text-small font-bold uppercase opacity-100",
                {
                  "w-0 opacity-0": isCollapsed,
                }
              )}>
              Chia1104.dev
            </span>
            <div className={cn("flex-end flex", { hidden: isCollapsed })}>
              <Icon
                className="cursor-pointer dark:text-primary-foreground/60 [&>g]:stroke-[1px]"
                icon="solar:round-alt-arrow-left-line-duotone"
                width={24}
                onClick={isMobile ? onOpenChange : onToggle}
              />
            </div>
          </div>
          <Spacer y={6} />
          <div className="flex items-center gap-3 px-3">
            <AuthGuard
              fallback={
                <>
                  <CircularProgress />
                  <div
                    className={cn("flex max-w-full flex-col", {
                      hidden: isCollapsed,
                    })}>
                    <Skeleton className="w-20 h-4 rounded-full" />
                  </div>
                </>
              }>
              {(session) => (
                <>
                  <Avatar
                    isBordered
                    size="sm"
                    showFallback={!session.user.image}
                    src={session.user.image ?? ""}
                  />
                  <div
                    className={cn("flex max-w-full flex-col", {
                      hidden: isCollapsed,
                    })}>
                    <p className="text-small font-medium text-foreground line-clamp-1">
                      {session.user.name}
                    </p>
                  </div>
                </>
              )}
            </AuthGuard>
          </div>

          <Spacer y={6} />

          <SideBar
            defaultSelectedKey={pathname}
            iconClassName="group-data-[selected=true]:text-default-50"
            isCompact={isCollapsed}
            itemClasses={{
              base: "px-3 rounded-large data-[selected=true]:!bg-foreground",
              title: "group-data-[selected=true]:text-default-50",
            }}
            items={routeItems}
            onSelect={(key) => {
              router.push(key as string);
            }}
          />

          <Spacer y={8} />

          <div
            className={cn("mt-auto flex flex-col", {
              "items-center": isCollapsed,
            })}>
            {isCollapsed && (
              <Button
                isIconOnly
                className="flex h-10 w-10 text-default-600"
                size="sm"
                variant="light">
                <Icon
                  className="cursor-pointer dark:text-primary-foreground/60 [&>g]:stroke-[1px]"
                  height={24}
                  icon="solar:round-alt-arrow-right-line-duotone"
                  width={24}
                  onClick={onToggle}
                />
              </Button>
            )}
            <Tooltip
              content="Support"
              isDisabled={!isCollapsed}
              placement="right">
              <Button
                fullWidth
                className={cn(
                  "justify-start truncate text-default-600 data-[hover=true]:text-foreground",
                  {
                    "justify-center": isCollapsed,
                  }
                )}
                isIconOnly={isCollapsed}
                startContent={
                  isCollapsed ? null : (
                    <Icon
                      className="flex-none text-default-600"
                      icon="solar:info-circle-line-duotone"
                      width={24}
                    />
                  )
                }
                variant="light">
                {isCollapsed ? (
                  <Icon
                    className="text-default-500"
                    icon="solar:info-circle-line-duotone"
                    width={24}
                  />
                ) : (
                  "Support"
                )}
              </Button>
            </Tooltip>
            <Popover backdrop="blur" isOpen={isPending ? true : undefined}>
              <Tooltip
                content="Log Out"
                isDisabled={!isCollapsed}
                placement="right">
                <PopoverTrigger>
                  <Button
                    className={cn(
                      "justify-start text-default-500 data-[hover=true]:text-foreground",
                      {
                        "justify-center": isCollapsed,
                      }
                    )}
                    isIconOnly={isCollapsed}
                    startContent={
                      isCollapsed ? null : (
                        <Icon
                          className="flex-none rotate-180 text-default-500"
                          icon="solar:minus-circle-line-duotone"
                          width={24}
                        />
                      )
                    }
                    variant="light">
                    {isCollapsed ? (
                      <Icon
                        className="rotate-180 text-default-500"
                        icon="solar:minus-circle-line-duotone"
                        width={24}
                      />
                    ) : (
                      "Sign Out"
                    )}
                  </Button>
                </PopoverTrigger>
              </Tooltip>
              <PopoverContent className="p-4 gap-3">
                <div className="text-small font-bold">
                  Are you sure you want to sign out?
                </div>
                <Button
                  isLoading={isPending}
                  color="danger"
                  variant="flat"
                  onPress={() =>
                    startTransition(async () => {
                      await authClient.signOut({
                        fetchOptions: {
                          onSuccess: () => {
                            router.push("/auth/signin"); // redirect to login page
                          },
                        },
                      });
                    })
                  }>
                  Sign Out
                </Button>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </Drawer>

      <div className="flex flex-col w-full">
        <Navbar
          isBordered
          className="flex items-center gap-x-3"
          classNames={{
            item: "data-[active=true]:text-primary",
            wrapper: "px-4 sm:px-6 max-w-full",
          }}
          height={isMobile ? "67px" : "80px"}>
          <Button
            isIconOnly
            className="sm:hidden"
            size="sm"
            variant="flat"
            onPress={() => {
              setIsCollapsed(false);
              onOpenChange();
            }}>
            <Icon
              className="text-default-500"
              icon="solar:sidebar-minimalistic-linear"
              width={20}
            />
          </Button>
          <h1 className="text-3xl font-bold leading-9 text-default-foreground">
            {currentItem?.title}
          </h1>
          {breadcrumbs.length > 1 && (
            <Breadcrumbs className="hidden md:block">
              {breadcrumbs.map((breadcrumb, index) => (
                <BreadcrumbItem
                  key={index}
                  href={breadcrumb.href}
                  isCurrent={index === breadcrumbs.length - 1}>
                  {breadcrumb.title}
                </BreadcrumbItem>
              ))}
            </Breadcrumbs>
          )}
        </Navbar>
        <main className="c-container flex-1 p-4">
          {currentItem?.items && currentItem.items.length > 0 && (
            <ScrollShadow
              hideScrollBar
              className="-mx-2 flex w-full justify-between gap-8"
              orientation="horizontal">
              <Tabs
                aria-label="Navigation Tabs"
                classNames={{
                  cursor: "bg-default-200 shadow-none",
                }}
                defaultSelectedKey={pathname}
                selectedKey={pathname}
                onSelectionChange={(key) => router.push(key as string)}
                radius="full"
                variant="light">
                {currentItem.items.map((item) => (
                  <Tab key={item.href} title={item.title} />
                ))}
              </Tabs>
              {currentItem.action && (
                <div className="flex items-center gap-4">
                  {currentItem.action}
                </div>
              )}
            </ScrollShadow>
          )}
          {props.children}
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default DashLayout;
