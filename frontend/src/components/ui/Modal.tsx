import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import Icon from "./Icon";

interface ModalProps {
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
  isBusy?: boolean;
  role?: "dialog" | "alertdialog";
}

export default function Modal({ title, description, children, onClose, isBusy = false, role = "dialog" }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>("input:not([type='hidden']):not(:disabled), select:not(:disabled), textarea:not(:disabled)")?.focus({ preventScroll: true });

    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      role={role}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={isBusy}
      className="m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-2xl border border-border bg-surface p-0 text-heading shadow-2xl backdrop:bg-secondary/65 backdrop:backdrop-blur-sm"
      onCancel={(event) => {
        event.preventDefault();
        if (!isBusy) onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget || isBusy) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
      }}
    >
      <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-5">
        <div>
          <h2 id={titleId} className="text-xl font-bold tracking-tight">{title}</h2>
          <p id={descriptionId} className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
        </div>
        <button type="button" onClick={onClose} disabled={isBusy} aria-label="Fechar modal" className="-mt-1 -mr-2 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-muted hover:bg-page focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-50">
          <Icon name="close" />
        </button>
      </div>
      <div className="px-6 pb-6">{children}</div>
    </dialog>
  );
}
