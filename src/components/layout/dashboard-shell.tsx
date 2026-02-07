"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent } from "react";

import { SystemHealthBadge } from "@/components/layout/system-health-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dashboardTabs } from "@/lib/navigation";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleTransitionNavigation = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      pathname === href
    ) {
      return;
    }

    const doc = document as Document & {
      startViewTransition?: (callback: () => void | Promise<void>) => void;
    };

    if (!doc.startViewTransition) {
      return;
    }

    event.preventDefault();
    doc.startViewTransition(() => {
      router.push(href);
    });
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_var(--color-muted),_transparent_45%),linear-gradient(to_bottom,var(--color-background),var(--color-background))]">
      <a
        className="sr-only z-50 rounded-md bg-background px-3 py-2 text-sm font-medium shadow focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
        href="#dashboard-main"
      >
        Skip to main content
      </a>
      <div className="mx-auto flex min-h-screen max-w-7xl gap-4 p-3 sm:p-4 md:gap-6 md:p-6">
        <aside className="hidden w-80 shrink-0 rounded-2xl border bg-card/90 p-4 backdrop-blur lg:flex lg:flex-col">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Live Ireland
            </p>
            <h1 className="text-xl font-semibold tracking-tight">National Dashboard</h1>
          </div>

          <nav aria-label="Primary dashboard sections" className="mt-6 space-y-2">
            {dashboardTabs.map((tab) => {
              const isActive = pathname === tab.href;
              const Icon = tab.icon;
              return (
                <Button
                  asChild
                  className="h-auto w-full min-w-0 justify-start gap-3 whitespace-normal px-3 py-3"
                  key={tab.href}
                  variant={isActive ? "default" : "ghost"}
                >
                  <Link
                    className="flex w-full min-w-0 items-start gap-3"
                    href={tab.href}
                    onClick={(event) => handleTransitionNavigation(event, tab.href)}
                  >
                    <Icon className="mt-0.5 size-4 shrink-0" />
                    <span className="min-w-0 text-left">
                      <span className="block break-words text-sm font-medium leading-5">
                        {tab.label}
                      </span>
                      <span
                        className={`mt-0.5 block break-words text-xs leading-4 ${
                          isActive ? "text-foreground/80" : "text-muted-foreground"
                        }`}
                      >
                        {tab.description}
                      </span>
                    </span>
                  </Link>
                </Button>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="rounded-2xl border bg-card/90 p-3 backdrop-blur sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold sm:text-lg">Real-Time National Signals</h2>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  Live streams for grid, weather, transport, and national alerts.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Phase 1 Scaffold</Badge>
                <SystemHealthBadge />
                <ThemeToggle />
              </div>
            </div>

            <nav
              aria-label="Mobile dashboard sections"
              className="mt-3 flex gap-2 overflow-x-auto lg:hidden"
            >
              {dashboardTabs.map((tab) => {
                const isActive = pathname === tab.href;
                return (
                  <Button
                    asChild
                    key={tab.href}
                    size="sm"
                    variant={isActive ? "default" : "outline"}
                  >
                    <Link
                      href={tab.href}
                      onClick={(event) => handleTransitionNavigation(event, tab.href)}
                    >
                      {tab.label}
                    </Link>
                  </Button>
                );
              })}
            </nav>
          </header>

          <main
            className="flex-1 rounded-2xl border bg-card/90 p-4 backdrop-blur sm:p-6"
            id="dashboard-main"
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
