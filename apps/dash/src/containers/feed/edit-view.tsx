"use client";

import dynamic from "next/dynamic";

import type { EditFormProps } from "@/components/feed/edit-form";

const EditForm = dynamic(() => import("@/components/feed/edit-form"), {
  ssr: false,
});

export default function EditView(props: EditFormProps) {
  return <EditForm {...props} />;
}
