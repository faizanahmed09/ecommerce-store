/*
 * ---------------------------------------------------------
 * POLICY DOCUMENTS
 * ---------------------------------------------------------
 *
 * The shape every written policy on the site shares: Returns,
 * Privacy, Terms and Shipping are all a run of headed sections
 * with paragraphs and, sometimes, a list.
 *
 * They had the same type declared twice under two names, and
 * the same twenty lines of markup written twice to render it.
 * One type here, one renderer in components/policy-sections.
 */

export interface PolicySection {
  title: string;
  /* Rendered as paragraphs. */
  body?: string[];
  /* Rendered as a bulleted list under the body. */
  points?: string[];
}

export interface PolicyDocument {
  title: string;
  intro: string;
  sections: PolicySection[];
}
