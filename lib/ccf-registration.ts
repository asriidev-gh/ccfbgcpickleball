export const CCF_ATTENDED_NOT_YET = "Not yet";

export const CCF_EVENT_OPTIONS = [
  "Sunday Service",
  "Women to Women Ministry",
  "Men's Ministry",
  "B1G Singles Ministry",
  "Elevate Youth Ministry",
  "True Life Retreat",
] as const;

export type CcfEventOption = (typeof CCF_EVENT_OPTIONS)[number];
