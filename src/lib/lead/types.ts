import type { ProjectConfiguration } from "@/lib/pool/project";

export const LEAD_TIMING_OPTIONS = [
  { id: "asap", label: "Appena possibile" },
  { id: "within3Months", label: "Entro 3 mesi" },
  { id: "threeToSixMonths", label: "3–6 mesi" },
  { id: "sixToTwelveMonths", label: "6–12 mesi" },
  { id: "evaluating", label: "Sto valutando" },
] as const;

export type LeadTimingId = (typeof LEAD_TIMING_OPTIONS)[number]["id"];

/** What the premium CTA form collects, before the server stamps
 * `requestId`/`createdAt` and attaches the canonical project. */
export interface LeadFormInput {
  customer: {
    name: string;
    email: string;
    phone: string;
    /** "Località del progetto" -- may differ from the contact's own city. */
    projectLocation: string;
  };
  commercial: {
    timing: LeadTimingId;
    notes: string;
  };
  privacy: {
    accepted: boolean;
    marketingConsent: boolean;
  };
  /** Honeypot anti-spam field; must stay empty. Not shown to real users. */
  website: string;
  /** Client-generated once per form session so a retried/duplicated request
   * reuses the same key -- lets the server de-duplicate best-effort. */
  idempotencyKey: string;
  project: ProjectConfiguration;
}

/** The complete, human-reviewable commercial record -- this is what gets
 * emailed/logged to Piscine Wellness, never raw JSON as the primary body. */
export interface LeadSubmission {
  requestId: string;
  projectId: string;
  schemaVersion: number;
  createdAt: string;
  customer: LeadFormInput["customer"];
  commercial: LeadFormInput["commercial"];
  project: ProjectConfiguration;
  privacy: LeadFormInput["privacy"];
  attachments: ReadonlyArray<never>;
}

export interface LeadSubmissionResult {
  success: true;
  requestId: string;
  projectId: string;
}

/** Thrown by the server function; codes the client maps to Italian copy.
 * `EMAIL_NOT_CONFIGURED` is the honest, expected outcome wherever
 * RESEND_API_KEY / LEAD_NOTIFY_EMAIL aren't set for this deployment. */
export type LeadSubmissionErrorCode =
  | "VALIDATION_FAILED"
  | "PAYLOAD_TOO_LARGE"
  | "RATE_LIMITED"
  | "EMAIL_NOT_CONFIGURED"
  | "EMAIL_SEND_FAILED";
