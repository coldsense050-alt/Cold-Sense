import Icon from "../../../components/ui/Icon";

interface FreezerFeedbackProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  isError?: boolean;
  isBusy?: boolean;
}

export default function FreezerFeedback({ title, message, actionLabel, onAction, isError = false, isBusy = false }: FreezerFeedbackProps) {
  return (
    <div className="flex min-h-64 flex-1 flex-col items-center justify-center rounded-2xl border border-border bg-surface p-8 text-center" role={isError ? "alert" : "status"}>
      <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary"><Icon name="freezer" className="size-7" /></span>
      <h3 className="text-lg font-semibold text-heading">{title}</h3>
      <p className="mt-2 max-w-md text-base leading-relaxed text-muted">{message}</p>
      {onAction && <button type="button" onClick={onAction} disabled={isBusy} className="mt-5 min-h-11 cursor-pointer rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60">{isBusy ? "Carregando..." : actionLabel}</button>}
    </div>
  );
}
