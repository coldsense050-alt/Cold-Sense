import type { ReactNode } from "react";

type IconName = "plus" | "search" | "chevron" | "edit" | "trash" | "close" | "users" | "freezer";

const paths: Record<IconName, ReactNode> = {
  plus: <path d="M12 5v14M5 12h14" />,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
  edit: <><path d="m15 5 4 4M4 20l4.5-1L20 7.5a2.8 2.8 0 0 0-4-4L4.5 15Z" /><path d="M13 20h7" /></>,
  trash: <><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  users: <><circle cx="9" cy="7" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-4-5.65" /></>,
  freezer: <><path d="M12 2v20M3.5 7l17 10M3.5 17l17-10M9 4l3 3 3-3M9 20l3-3 3 3" /></>,
};

export default function Icon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
