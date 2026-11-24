import type { ReactNode } from "react";

type IconName = "plus" | "search" | "chevron" | "edit" | "trash" | "close" | "users" | "freezer" | "refresh" | "checkCircle" | "alertTriangle" | "alertOctagon" | "helpCircle";

const paths: Record<IconName, ReactNode> = {
  plus: <path d="M12 5v14M5 12h14" />,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
  edit: <><path d="m15 5 4 4M4 20l4.5-1L20 7.5a2.8 2.8 0 0 0-4-4L4.5 15Z" /><path d="M13 20h7" /></>,
  trash: <><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  users: <><circle cx="9" cy="7" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-4-5.65" /></>,
  freezer: <><rect x="5" y="2" width="14" height="19" rx="2" /><path d="M5 9h14M8 5v1M8 12v4M8 21v1M16 21v1" /></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 7a7 7 0 0 1 11-2l3 3M4 16l3 3a7 7 0 0 0 11-2" /></>,
  checkCircle: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5 5.5-5.5" /></>,
  alertTriangle: <><path d="m10.3 3.9-8.2 14.2A2 2 0 0 0 3.8 21h16.4a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4m0 4h.01" /></>,
  alertOctagon: <><path d="m7.5 3-4.5 4.5v9L7.5 21h9l4.5-4.5v-9L16.5 3Z" /><path d="M12 7v6m0 4h.01" /></>,
  helpCircle: <><circle cx="12" cy="12" r="9" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4m.1 3h.01" /></>,

};

export default function Icon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
