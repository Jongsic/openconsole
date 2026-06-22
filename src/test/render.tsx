import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RenderOptions, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement, ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { ToastViewport } from "@/components/toast";
import i18n from "@/i18n";

/**
 * Wrap a component in the same providers the app uses, so component tests behave
 * like the real app minus the network:
 *  - QueryClientProvider with `retry: false` (failed queries surface immediately,
 *    no waiting on retries that slow the suite and mask the error branch).
 *  - The real i18n instance, so `t()` returns actual English strings — tests can
 *    assert on visible copy.
 *  - MemoryRouter, so pages that use `useNavigate`/`useParams` render.
 *  - ToastViewport, so success/error toasts emitted by mutations are queryable.
 *
 * Returns testing-library's render result plus a pre-bound `user` (userEvent)
 * instance for convenience.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: { route?: string; initialEntries?: string[] } & Omit<RenderOptions, "wrapper"> = {},
) {
  const { route, initialEntries, ...renderOptions } = options;
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  const entries = initialEntries ?? (route ? [route] : ["/"]);

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <MemoryRouter initialEntries={entries}>
            {children}
            <ToastViewport />
          </MemoryRouter>
        </I18nextProvider>
      </QueryClientProvider>
    );
  }

  return {
    user: userEvent.setup(),
    queryClient,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

export * from "@testing-library/react";
export { userEvent };
