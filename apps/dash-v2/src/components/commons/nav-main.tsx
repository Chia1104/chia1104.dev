"use client";

import { useRouter } from "next/navigation";

import { Button } from "@heroui/react";
import { ChevronRight } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@chia/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  useSidebar,
} from "@chia/ui/sidebar";

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
  const router = useRouter();
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{title}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <Collapsible
            key={item.title}
            asChild
            defaultOpen={item.isActive}
            className="group/collapsible">
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <Button
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
                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      ) : (
                        <span className="ml-auto" />
                      )}
                    </>
                  ) : null}
                </Button>
              </CollapsibleTrigger>
              {item.items ? (
                <CollapsibleContent>
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
                </CollapsibleContent>
              ) : null}
            </SidebarMenuItem>
          </Collapsible>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
