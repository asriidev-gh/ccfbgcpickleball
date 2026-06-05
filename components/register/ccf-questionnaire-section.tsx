"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CCF_EVENT_OPTIONS } from "@/lib/ccf-registration";
import { cn } from "@/lib/utils";

export type CcfEventsBeforeAnswer = "yes" | "not_yet";

type CcfQuestionnaireSectionProps = {
  ccfEventsBefore: CcfEventsBeforeAnswer | null;
  attendedEvents: string[];
  isPartOfDgroup: boolean | null;
  wantsToJoinDgroup: boolean | null;
  fieldErrors: Record<string, string>;
  disabled?: boolean;
  eventsBlockRef?: React.RefObject<HTMLDivElement | null>;
  dgroupBlockRef?: React.RefObject<HTMLDivElement | null>;
  joinDgroupBlockRef?: React.RefObject<HTMLDivElement | null>;
  onSelectCcfEventsBefore: (answer: CcfEventsBeforeAnswer) => void;
  onToggleEvent: (item: string, checked: boolean) => void;
  onSelectDgroupMembership: (inDgroup: boolean) => void;
  onSelectWantsToJoinDgroup: (wantsToJoin: boolean) => void;
  renderFieldError: (name: string) => React.ReactNode;
};

export function CcfQuestionnaireSection({
  ccfEventsBefore,
  attendedEvents,
  isPartOfDgroup,
  wantsToJoinDgroup,
  fieldErrors,
  disabled = false,
  eventsBlockRef,
  dgroupBlockRef,
  joinDgroupBlockRef,
  onSelectCcfEventsBefore,
  onToggleEvent,
  onSelectDgroupMembership,
  onSelectWantsToJoinDgroup,
  renderFieldError,
}: CcfQuestionnaireSectionProps) {
  return (
    <>
      <div
        ref={eventsBlockRef}
        tabIndex={-1}
        className={cn(
          "register-block rounded-lg outline-none",
          fieldErrors.attendedEvents && "ring-2 ring-destructive/40",
        )}
      >
        <Label className="register-label">Have you attended any other CCF events before?</Label>
        <div className="register-toggle-row">
          <Button
            type="button"
            variant={ccfEventsBefore === "yes" ? "default" : "outline"}
            className="register-toggle-btn"
            onClick={() => onSelectCcfEventsBefore("yes")}
            disabled={disabled}
          >
            Yes
          </Button>
          <Button
            type="button"
            variant={ccfEventsBefore === "not_yet" ? "default" : "outline"}
            className="register-toggle-btn"
            onClick={() => onSelectCcfEventsBefore("not_yet")}
            disabled={disabled}
          >
            Not Yet
          </Button>
        </div>
        {renderFieldError("attendedEvents")}
      </div>

      {ccfEventsBefore === "yes" ? (
        <>
          <div className="register-block">
            <Label className="register-label">Which event?</Label>
            <div className="register-checklist">
              {CCF_EVENT_OPTIONS.map((item) => {
                const checked = attendedEvents.includes(item);
                return (
                  <label
                    key={item}
                    className={cn("register-checklist-item", checked && "is-checked")}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => onToggleEvent(item, Boolean(value))}
                      disabled={disabled}
                    />
                    <span>{item}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div
            ref={dgroupBlockRef}
            tabIndex={-1}
            className={cn(
              "register-block rounded-lg outline-none",
              fieldErrors.isPartOfDgroup && "ring-2 ring-destructive/40",
            )}
          >
            <Label className="register-label">Are you in a D-group?</Label>
            <div className="register-toggle-row">
              <Button
                type="button"
                variant={isPartOfDgroup === true ? "default" : "outline"}
                className="register-toggle-btn"
                onClick={() => onSelectDgroupMembership(true)}
                disabled={disabled}
              >
                Yes
              </Button>
              <Button
                type="button"
                variant={isPartOfDgroup === false ? "default" : "outline"}
                className="register-toggle-btn"
                onClick={() => onSelectDgroupMembership(false)}
                disabled={disabled}
              >
                No
              </Button>
            </div>
            {renderFieldError("isPartOfDgroup")}
          </div>

          {isPartOfDgroup === false ? (
            <div
              ref={joinDgroupBlockRef}
              tabIndex={-1}
              className={cn(
                "register-block rounded-lg outline-none",
                fieldErrors.wantsToJoinDgroup && "ring-2 ring-destructive/40",
              )}
            >
              <Label className="register-label">Do you want to join a dgroup?</Label>
              <div className="register-toggle-row">
                <Button
                  type="button"
                  variant={wantsToJoinDgroup === true ? "default" : "outline"}
                  className="register-toggle-btn"
                  onClick={() => onSelectWantsToJoinDgroup(true)}
                  disabled={disabled}
                >
                  Yes
                </Button>
                <Button
                  type="button"
                  variant={wantsToJoinDgroup === false ? "default" : "outline"}
                  className="register-toggle-btn"
                  onClick={() => onSelectWantsToJoinDgroup(false)}
                  disabled={disabled}
                >
                  Not Yet
                </Button>
              </div>
              {renderFieldError("wantsToJoinDgroup")}
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}
