export const COURTS_VIEW_LEASE_BANNER_COLLAPSED_KEY = "ccf-courts-view-lease-banner-collapsed";

export function loadCourtsViewLeaseBannerCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(COURTS_VIEW_LEASE_BANNER_COLLAPSED_KEY) === "true";
}

export function saveCourtsViewLeaseBannerCollapsed(collapsed: boolean) {
  localStorage.setItem(COURTS_VIEW_LEASE_BANNER_COLLAPSED_KEY, collapsed ? "true" : "false");
}
