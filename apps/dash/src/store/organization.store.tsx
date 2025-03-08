"use client";

import { createContext, useRef, use } from "react";
import type { ReactNode } from "react";

import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

export interface OrganizationState {
  currentOrgSlug: string;
  currentOrgId: string;
  currentOrgName: string;
}

export type OrganizationStore = OrganizationState;

export const defaultInitState: OrganizationState = {
  currentOrgSlug: "",
  currentOrgId: "",
  currentOrgName: "",
};

export const createOrganizationStore = (
  initState?: Partial<OrganizationState>
) => {
  const state = Object.assign({ ...defaultInitState }, initState);
  return createStore<OrganizationStore>()(() => state);
};

export type OrganizationStoreApi = ReturnType<typeof createOrganizationStore>;

export const OrganizationStoreContext = createContext<
  OrganizationStoreApi | undefined
>(undefined);

export interface OrganizationStoreProviderProps {
  children: ReactNode;
  values?: Partial<OrganizationState>;
}

export const OrganizationStoreProvider = ({
  children,
  values,
}: OrganizationStoreProviderProps) => {
  const storeRef = useRef<OrganizationStoreApi>(null);
  if (!storeRef.current) {
    storeRef.current = createOrganizationStore(values);
  }

  return (
    <OrganizationStoreContext value={storeRef.current}>
      {children}
    </OrganizationStoreContext>
  );
};

export const useOrganizationStore = <T,>(
  selector: (store: OrganizationStore) => T
): T => {
  const organizationStoreContext = use(OrganizationStoreContext);

  if (!organizationStoreContext) {
    throw new Error(
      `useOrganizationStore must be used within OrganizationStoreProvider`
    );
  }

  return useStore(organizationStoreContext, selector);
};
