"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { ThemeMenu } from "@/components/theme-menu";
import { UserMenu } from "@/components/user-menu";
import { APP_NAME } from "@/lib/app-config";
import { getBrandShellClasses, isPublicAppPath, shouldHideAppBrandBar } from "@/lib/app-shell";
import { cn } from "@/lib/utils";

export function AppBrandBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fromParam = searchParams.get("from");
  const { pad, container } = getBrandShellClasses(pathname);
  const showThemeOnly = isPublicAppPath(pathname, fromParam);

  if (shouldHideAppBrandBar(pathname)) {
    return null;
  }

  return (
    <header className="app-brand-bar">
      <div className={pad}>
        <div className={cn("app-brand-bar__inner mx-auto flex w-full items-center justify-between gap-3", container)}>
          <span className="app-brand">{APP_NAME}</span>
          <div className="app-brand-actions shrink-0">
            {showThemeOnly ? <ThemeMenu /> : <UserMenu />}
          </div>
        </div>
      </div>
    </header>
  );
}
