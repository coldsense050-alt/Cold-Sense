type EmptyStateProps = {
  message: string;
};

export default function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="flex min-h-36 items-center justify-center rounded-lg bg-surface p-6 text-center text-xs text-muted">
      {message}
    </div>
  );
}
