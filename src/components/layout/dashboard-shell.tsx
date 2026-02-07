"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { useEffect, useState } from "react";

import { SystemHealthBadge } from "@/components/layout/system-health-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dashboardTabs } from "@/lib/navigation";

function LiveClock() {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-IE", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }),
      );
      setDate(
        now.toLocaleDateString("en-IE", {
          weekday: "short",
          day: "numeric",
          month: "short",
        }),
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="text-right tabular-nums">
      <p className="text-sm font-semibold tracking-tight text-foreground">{time}</p>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{date}</p>
    </div>
  );
}

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
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Ambient background glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
      >
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[oklch(0.55_0.18_260_/_0.06)] blur-[100px] dark:bg-[oklch(0.55_0.18_260_/_0.08)]" />
        <div className="absolute -left-32 top-1/3 h-80 w-80 rounded-full bg-[oklch(0.60_0.16_195_/_0.04)] blur-[100px] dark:bg-[oklch(0.60_0.16_195_/_0.06)]" />
        <div className="absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-[oklch(0.55_0.20_290_/_0.03)] blur-[100px] dark:bg-[oklch(0.55_0.20_290_/_0.05)]" />
      </div>

      <a
        className="sr-only z-50 rounded-md bg-background px-3 py-2 text-sm font-medium shadow focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
        href="#dashboard-main"
      >
        Skip to main content
      </a>

      <div className="mx-auto flex min-h-screen max-w-[1600px] gap-4 p-3 sm:p-4 md:gap-5 md:p-5">
        {/* ─── Sidebar ─── */}
        <aside className="glass-card hidden w-72 shrink-0 rounded-2xl p-4 lg:flex lg:flex-col">
          {/* Logo area */}
          <div className="mb-1 flex items-center gap-3 px-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-lg">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-primary">
                Live Ireland
              </p>
              <h1 className="text-base font-bold tracking-tight">National Dashboard</h1>
            </div>
          </div>

          {/* Divider */}
          <div className="mx-1 my-4 border-t border-border/60" />

          <nav aria-label="Primary dashboard sections" className="flex-1 space-y-1">
            {dashboardTabs.map((tab) => {
              const isActive = pathname === tab.href;
              const Icon = tab.icon;
              return (
                <Button
                  asChild
                  className={`h-auto w-full min-w-0 justify-start gap-3 whitespace-normal px-3 py-2.5 transition-all duration-200 ${
                    isActive ? "nav-active-glow" : ""
                  }`}
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
                        className={`mt-0.5 block break-words text-[11px] leading-4 ${
                          isActive ? "text-foreground/70" : "text-muted-foreground"
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

          {/* Sidebar footer */}
          <div className="mt-auto space-y-3 pt-4">
            <div className="mx-1 border-t border-border/60" />
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="live-dot" />
                <span className="text-[11px] font-medium text-muted-foreground">Live Data</span>
              </div>
              <LiveClock />
            </div>
          </div>
        </aside>

        {/* ─── Main area ─── */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* Header */}
          <header className="glass-card rounded-2xl p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* Mobile logo */}
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-base lg:hidden">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight sm:text-lg">
                    Real-Time National Signals
                  </h2>
                  <p className="hidden text-xs text-muted-foreground sm:block">
                    Live infrastructure monitoring across grid, weather, transport, and alerts
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden items-center gap-1.5 sm:flex">
                  <div className="live-dot" />
                  <span className="text-[11px] font-medium text-muted-foreground lg:hidden">Live</span>
                </div>
                <SystemHealthBadge />
                <ThemeToggle />
              </div>
            </div>

            {/* Mobile nav */}
            <nav
              aria-label="Mobile dashboard sections"
              className="mt-3 flex gap-2 overflow-x-auto lg:hidden"
            >
              {dashboardTabs.map((tab) => {
                const isActive = pathname === tab.href;
                const Icon = tab.icon;
                return (
                  <Button
                    asChild
                    className={`gap-1.5 ${isActive ? "nav-active-glow" : ""}`}
                    key={tab.href}
                    size="sm"
                    variant={isActive ? "default" : "outline"}
                  >
                    <Link
                      href={tab.href}
                      onClick={(event) => handleTransitionNavigation(event, tab.href)}
                    >
                      <Icon className="size-3.5" />
                      {tab.label}
                    </Link>
                  </Button>
                );
              })}
            </nav>
          </header>

          {/* Main content */}
          <main
            className="glass-card flex-1 rounded-2xl p-4 sm:p-6"
            id="dashboard-main"
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
