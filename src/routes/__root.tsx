import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { THEME_BOOT_SCRIPT } from "../lib/theme";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { installChunkReloadGuard } from "../lib/chunk-reload-guard";
import { Toaster } from "../components/ui/sonner";
import { LocaleProvider, useI18n } from "@/lib/i18n";

function NotFoundComponent() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{t("Pagina non trovata")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("La pagina cercata non esiste o è stata spostata.")}
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("Torna alla home")}
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Full error text, always visible on the page itself -- not just in
 * console.error -- so a report can be copied straight off the error screen
 * with no DevTools involved: message, stack, and the React component stack
 * when the router's error boundary captured one.
 */
function formatErrorDiagnostics(error: unknown, info?: { componentStack: string }): string {
  const parts = [
    `Message: ${error instanceof Error ? error.message || "(no message)" : String(error)}`,
    error instanceof Error && error.stack ? `Stack:\n${error.stack}` : "Stack: (not available)",
  ];
  if (info?.componentStack) {
    parts.push(`Component stack:${info.componentStack}`);
  }
  return parts.join("\n\n");
}

function ErrorDiagnostics({
  error,
  info,
}: {
  error: unknown;
  info: { componentStack: string } | undefined;
}) {
  const { t } = useI18n();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const diagnostics = formatErrorDiagnostics(error, info);

  return (
    <div className="mt-6 w-full text-left">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("Dettagli errore")}
        </h2>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(diagnostics);
              setCopyState("copied");
            } catch {
              setCopyState("failed");
            }
            setTimeout(() => setCopyState("idle"), 2000);
          }}
          className="inline-flex items-center justify-center rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
        >
          {copyState === "copied"
            ? t("Copiato")
            : copyState === "failed"
              ? t("Seleziona il testo per copiarlo")
              : t("Copia")}
        </button>
      </div>
      <pre className="max-h-64 select-text overflow-auto whitespace-pre-wrap break-words rounded-md border border-input bg-muted/40 p-3 text-left text-[11px] leading-snug text-foreground">
        {diagnostics}
      </pre>
    </div>
  );
}

function ErrorComponent({
  error,
  info,
  reset,
}: {
  error: unknown;
  info?: { componentStack: string };
  reset: () => void;
}) {
  const { t } = useI18n();
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t("Impossibile caricare la pagina")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("Si è verificato un errore. Riprova o torna alla home.")}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("Riprova")}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {t("Torna alla home")}
          </a>
        </div>
        <ErrorDiagnostics error={error} info={info} />
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Lovable App" },
      { name: "description", content: "Lovable Generated Project" },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Lovable App" },
      { property: "og:description", content: "Lovable Generated Project" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        <LocaleProvider>{children}</LocaleProvider>
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    installChunkReloadGuard();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      {/* Global toast host -- currently only used to surface Photo Mode's
          "this device can't run the path tracer" message without a full
          error page (see PoolConfigurator's handlePhotoModeUnsupported). */}
      <Toaster />
    </QueryClientProvider>
  );
}
