export default function AuthLoading() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-secondary px-6">
      <div role="status" className="text-center text-white/80">
        <div
          className="mx-auto mb-4 h-9 w-9 rounded-full border-3 border-accent/20 border-t-accent motion-safe:animate-spin"
          aria-hidden="true"
        />
        <p className="text-base font-medium">Verificando sua sessão...</p>
      </div>
    </main>
  );
}
