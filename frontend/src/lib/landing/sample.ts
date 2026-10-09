import type { CheckStatus } from "@/lib/api/schemas";

/*
 * Scripted content for the landing page demos. Fictional: the document, its
 * ID and every number below are made up to show how the interface behaves.
 */
export const SAMPLE_DOC = { id: "DOC-5A3F12C0", title: "Harbour Lane residential lease (fictional sample)" };

export const SAMPLE_QUESTION = "When do I get my deposit back, and can I keep a cat?";

export type ReplayPart = { text: string } | { cite: { page: number; status: CheckStatus; coverage: number } };

export const SAMPLE_ANSWER: ReplayPart[] = [
  { text: "The security deposit is refunded within 30 days of the tenant vacating the premises " },
  { cite: { page: 4, status: "supported", coverage: 0.92 } },
  { text: ". Any deduction must come with an itemised statement " },
  { cite: { page: 4, status: "supported", coverage: 0.8 } },
  { text: ". Pets, including cats, need the landlord’s written consent first " },
  { cite: { page: 7, status: "partial", coverage: 0.57 } },
  { text: "." },
];

export const SAMPLE_PASSAGES = [
  { page: 4, section: "4. Security deposit", text: "The security deposit shall be refunded within 30 days of the tenant vacating the premises. Deductions require an itemised statement." },
  { page: 7, section: "9. Pets", text: "No animals may be kept at the premises without the prior written consent of the landlord." },
];

/** For the verification explainer: one page of text and three claims that cite it. */
export const VERIFY_PAGE =
  "4. Security deposit. The security deposit shall be refunded within 30 days of the tenant vacating the premises. Deductions require an itemised statement delivered to the tenant. Interest is not payable on the deposit.";

export const VERIFY_CLAIMS = [
  { claim: "The security deposit is refunded within 30 days of vacating the premises.", note: "Every key word is on the page." },
  { claim: "Deductions from the deposit need an itemised statement and a photo inventory.", note: "“Photo inventory” is not on the page, so only part of the claim is backed." },
  { claim: "The landlord pays interest on the deposit every quarter.", note: "Most of the claim has no basis on the page." },
  {
    claim: "Interest is payable on the deposit.",
    note: "The limit, shown honestly: every word is on the page, but the page says interest is NOT payable. Word overlap cannot see negation.",
  },
];
