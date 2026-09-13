"use client";

import { Button, Disclosure } from "@heroui/react";
import { ChevronRight } from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  useSidebar,
} from "@chia/ui/sidebar";

import { useGuardedRouter } from "@/libs/navigation-guard";

export interface NavMainItem {
  title: string;
  url: string;
  icon?: React.ReactElement;
  isActive?: boolean;
  items?: NavMainItem[];
}

export function NavMain({
  title,
  items,
}: {
  title: string;
  items: NavMainItem[];
}) {
  const { open, isMobile } = useSidebar();
  const router = useGuardedRouter();
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{title}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.title}>
            <Disclosure
              defaultExpanded={item.isActive}
              className="group/collapsible">
              {/* The trigger slot toggles the sub-items while onPress navigates. */}
              <Button
                slot="trigger"
                variant={item.isActive ? "tertiary" : "ghost"}
                fullWidth
                isIconOnly={isMobile ? false : !open}
                size="sm"
                onPress={() => router.push(item.url)}>
                {item.icon && item.icon}
                {isMobile || open ? (
                  <>
                    <span>{item.title}</span>
                    {item.items ? (
                      <ChevronRight className="ml-auto transition-transform duration-200 group-data-expanded/collapsible:rotate-90" />
                    ) : (
                      <span className="ml-auto" />
                    )}
                  </>
                ) : null}
              </Button>
              {item.items ? (
                <Disclosure.Content>
                  <SidebarMenuSub className="mr-0 pr-0">
                    {item.items?.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.title}>
                        <Button
                          size="sm"
                          variant={subItem.isActive ? "tertiary" : "ghost"}
                          className="justify-start"
                          fullWidth
                          isIconOnly={!open}
                          onPress={() => router.push(subItem.url)}>
                          {subItem.title}
                        </Button>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </Disclosure.Content>
              ) : null}
            </Disclosure>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
