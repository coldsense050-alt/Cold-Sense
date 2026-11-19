import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { isAuthError } from "@supabase/supabase-js";
import { Navigate, useLocation } from "react-router";
import AuthLoading from "../../components/auth/AuthLoading";
import { useAuth } from "../../hooks/useAuth";

const inputClasses =
  "min-h-13 w-full rounded-xl border border-border bg-surface py-3 pl-11 text-base text-heading outline-none transition-[border-color,box-shadow] placeholder:text-placeholder hover:border-border-hover focus:border-primary focus:ring-3 focus:ring-primary/8 disabled:cursor-wait disabled:opacity-70 motion-reduce:transition-none";

const labelClasses = "mb-2 block text-sm font-semibold text-body";

const fieldIconClasses =
  "pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-placeholder";

function loginErrorMessage(error: unknown) {
  if (isAuthError(error)) {
    if (error.code === "invalid_credentials") {
      return "E-mail ou senha incorretos. Verifique seus dados e tente novamente.";
    }

    if (error.code === "email_not_confirmed") {
      return "Confirme seu e-mail antes de entrar. Se precisar, fale com o administrador.";
    }

    if (error.status === 429) {
      return "Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.";
    }

    if (error.code === "user_banned") {
      return "Seu acesso está indisponível. Entre em contato com o administrador.";
    }
  }

  return "Não foi possível entrar. Verifique sua conexão e tente novamente.";
}

function Snowflake({ className = "size-7" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2v20M3.34 7l17.32 10M3.34 17 20.66 7M9 4l3 3 3-3M9 20l3-3 3 3M3.6 10.6l4.1-1.1-1.1-4.1M17.4 18.6l-1.1-4.1 4.1-1.1M6.6 18.6l1.1-4.1-4.1-1.1M20.4 10.6l-4.1-1.1 1.1-4.1" />
    </svg>
  );
}

export default function Login() {
  const { session, isLoading, signIn } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Login | ColdSense";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      await signIn(email, password);
    } catch (signInError) {
      setError(loginErrorMessage(signInError));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return <AuthLoading />;

  if (session) {
    const destination = location.state?.from === "/freezer-ai" ? "/freezer-ai" : "/";
    return <Navigate to={destination} replace />;
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-secondary px-4 py-6 md:p-8 lg:px-16 lg:py-12 compact:py-8">
      <div className="grid w-full max-w-md grid-cols-1 items-center gap-7 md:min-h-172 md:max-w-304 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-8 lg:gap-[clamp(3rem,7vw,7rem)] compact:min-h-0">
        <section
          className="flex h-full min-w-0 flex-col justify-between px-2 text-white md:px-0 md:py-6"
          aria-label="ColdSense: monitoramento de refrigeração"
        >
          <div className="flex items-center gap-3 text-[1.35rem] font-bold tracking-[-0.04em] md:text-2xl">
            <span className="flex size-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-accent">
              <Snowflake />
            </span>
            <span>ColdSense</span>
          </div>

          <div className="pt-5 md:pt-13 md:pb-10 compact:pt-8 compact:pb-6">
            <p className="mb-5 hidden text-xs font-semibold tracking-[0.15em] text-accent md:block">
              MONITORAMENTO INTELIGENTE
            </p>
            <h2 className="text-[1.65rem] leading-[1.2] font-[650] tracking-[-0.045em] md:text-[2rem] lg:text-[clamp(2rem,3.2vw,2.75rem)]">
              Tudo sob controle.<br />
              <span className="text-accent">Em qualquer temperatura.</span>
            </h2>
            <p className="mt-5 hidden max-w-92 text-base leading-7 text-white/80 md:block">
              Mais visibilidade para sua operação. Mais tranquilidade para cuidar do que importa.
            </p>

            <div className="relative my-5 hidden h-34 items-center justify-center md:flex" aria-hidden="true">
              <div className="flex size-26 items-center justify-center rounded-full border border-accent/20 bg-accent/4 text-accent shadow-frost">
                <Snowflake className="size-14" />
              </div>
              <svg
                className="absolute inset-x-0 top-6 h-22 w-full text-accent/20"
                viewBox="0 0 420 100"
                fill="none"
                preserveAspectRatio="none"
              >
                <path
                  d="M0 65H35L55 45 78 76 105 32 128 55H175L195 70 220 48H260L280 25 305 55H345L365 40 385 55H420"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <ul className="hidden gap-3.5 md:grid">
              {[
                "Temperaturas e equipamentos em um só lugar",
                "Análises inteligentes com a Freezer AI",
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-2.5 text-sm leading-normal text-white/85">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs text-accent" aria-hidden="true">
                    ✓
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <p className="hidden text-[0.8125rem] text-white/65 md:block">
            Conectado ao cuidado com a sua operação.
          </p>
        </section>

        <section
          className="flex min-w-0 flex-col items-center justify-center rounded-3xl border border-white/20 bg-surface px-6 pt-8 pb-6 shadow-login md:min-h-172 md:rounded-[2rem] md:px-7 md:pt-10 md:pb-7 lg:px-12 lg:pt-12 compact:min-h-0 compact:pt-8 compact:pb-6"
          aria-labelledby="login-heading"
        >
          <div className="my-auto w-full max-w-92">
            <div className="mb-7 hidden size-12 items-center justify-center rounded-[0.875rem] border border-primary/15 bg-primary-soft text-primary md:flex compact:hidden" aria-hidden="true">
              <Snowflake className="size-7.5" />
            </div>
            <p className="mb-3 text-xs font-semibold tracking-[0.12em] text-muted">
              ACESSE SUA CONTA
            </p>
            <h1 id="login-heading" className="text-[1.75rem] leading-tight font-bold tracking-[-0.04em] text-heading md:text-[1.7rem] lg:text-[1.9rem]">
              Bem-vindo de volta
            </h1>
            <p className="mt-3 mb-6 text-base leading-relaxed text-muted md:mb-8">
              Entre para acompanhar seus freezers.
            </p>

            <form onSubmit={handleSubmit} aria-busy={isSubmitting}>
              <fieldset disabled={isSubmitting} className="grid min-w-0 gap-5 border-0 p-0">
                <div>
                  <label htmlFor="login-email" className={labelClasses}>E-mail</label>
                  <div className="relative">
                    <svg className={fieldIconClasses} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="5" width="18" height="14" rx="3" />
                      <path d="m3 7 9 6 9-6" />
                    </svg>
                    <input
                      id="login-email"
                      name="email"
                      type="email"
                      autoComplete="username"
                      placeholder="voce@empresa.com"
                      className={`${inputClasses} pr-4`}
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setError(null);
                      }}
                      aria-describedby={error ? "login-error" : undefined}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="login-password" className={labelClasses}>Senha</label>
                  <div className="relative">
                    <svg className={fieldIconClasses} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="4" y="10" width="16" height="11" rx="3" />
                      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
                    </svg>
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Digite sua senha"
                      className={`${inputClasses} pr-12`}
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        setError(null);
                      }}
                      aria-describedby={error ? "login-error" : undefined}
                      required
                    />
                    <button
                      type="button"
                      className="absolute top-1/2 right-1.5 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-primary-soft hover:text-heading focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-primary/60 disabled:cursor-wait disabled:opacity-70"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      aria-pressed={showPassword}
                      aria-controls="login-password"
                    >
                      <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                        <circle cx="12" cy="12" r="3" />
                        {showPassword && <path d="m3 3 18 18" />}
                      </svg>
                    </button>
                  </div>
                </div>

                {error && (
                  <p id="login-error" className="rounded-xl border border-danger-border bg-danger-soft px-4 py-3 text-sm leading-relaxed wrap-anywhere text-danger" role="alert">
                    {error}
                  </p>
                )}

                <button
                  className="mt-1 flex min-h-13 cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-primary px-5 py-3 text-base font-semibold text-white transition-[background-color,box-shadow] enabled:hover:bg-primary-hover enabled:hover:shadow-md enabled:hover:shadow-primary/15 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-primary/60 disabled:cursor-wait disabled:opacity-70 motion-reduce:transition-none"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting && (
                    <span className="size-4.5 rounded-full border-2 border-white/30 border-t-white motion-safe:animate-spin" aria-hidden="true" />
                  )}
                  {isSubmitting ? "Entrando..." : "Entrar na conta"}
                </button>
              </fieldset>
            </form>

            <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs leading-relaxed text-muted">
              <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" />
                <path d="m8.5 12 2.5 2.5 4.5-5" />
              </svg>
              Acesso exclusivo para usuários autorizados
            </p>

            <div className="mt-8 border-t border-border-soft pt-6 text-center text-sm leading-[1.7] text-muted compact:mt-6 compact:pt-5">
              <p className="font-semibold text-body">Ainda não tem acesso?</p>
              <p>Solicite suas credenciais ao administrador.</p>
            </div>
          </div>
          <p className="mt-8 text-center text-xs text-muted/85 md:mt-10 compact:mt-6">
            ColdSense · Monitoramento de refrigeração
          </p>
        </section>
      </div>
    </main>
  );
}
