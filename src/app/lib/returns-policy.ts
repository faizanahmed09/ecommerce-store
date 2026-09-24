/*
 * ---------------------------------------------------------
 * RETURNS & EXCHANGES POLICY
 * ---------------------------------------------------------
 *
 * The wording customers are held to, kept out of the page so
 * it can be changed without touching layout.
 *
 * THESE NUMBERS ARE A STARTING POINT, NOT A DECISION. The
 * window, the discount threshold and the voucher-only rule are
 * commercial choices - confirm each against what the shop
 * actually does, and against consumer law where you sell,
 * before this goes live. A policy the shop does not honour is
 * worse than none.
 */

import type { PolicySection } from "@/src/app/lib/policy";

/* Days from delivery in which an exchange can be requested. */
export const EXCHANGE_WINDOW_DAYS = 10;

/*
 * Discount above which an item is final sale. Set to 100 to
 * allow exchanges on everything regardless of discount.
 */
export const FINAL_SALE_DISCOUNT_PERCENT = 30;

/* Hours from delivery to report a damaged or wrong item. */
export const DEFECT_REPORT_HOURS = 24;

export const POLICY_SECTIONS: PolicySection[] = [
  {
    title: "What can be exchanged",
    body: [
      `Anything bought online can be exchanged within ${EXCHANGE_WINDOW_DAYS} days of delivery for the same item in a different size or colour, subject to availability.`,
      "If the size or colour you want is no longer in stock, we will issue a store credit for the amount you paid instead.",
    ],
  },
  {
    title: "Store credit, not cash",
    body: [
      "We do not issue cash refunds. Returned and exchanged items are credited as a store voucher for the value you paid, usable on the online store.",
      "Vouchers can be used straight away or kept for later, and can be spent across more than one order until the balance runs out.",
    ],
  },
  {
    title: "Condition we can accept",
    body: ["An item has to come back in the state it reached you in. That means:"],
    points: [
      "Unworn and unwashed, with no marks, scent or alteration.",
      "All original tags still attached and intact.",
      "In its original packaging.",
      "With the original invoice or order number.",
    ],
  },
  {
    title: "What cannot be exchanged",
    body: ["Some items are final sale and cannot be exchanged or credited:"],
    points: [
      `Items bought at more than ${FINAL_SALE_DISCOUNT_PERCENT}% off.`,
      "Anything worn, washed, altered, marked or damaged after delivery.",
      "Items returned without their tags, packaging or proof of purchase.",
      "Items bought during a clearance or final-sale campaign, where this is stated at checkout.",
    ],
  },
  {
    title: "Who pays for return postage",
    body: [
      "If the item is faulty, damaged in transit, or not what you ordered, we cover the cost of getting it back to us.",
      "If you have changed your mind, ordered the wrong size, or simply do not like it, the return postage is yours to cover.",
    ],
  },
  {
    title: "Damaged, wrong or missing items",
    body: [
      `Tell us within ${DEFECT_REPORT_HOURS} hours of delivery if something arrives damaged, incomplete, or is not what you ordered. Send photographs of the item, its tags, and the packaging inside and out.`,
      `We may not be able to help with claims raised after ${DEFECT_REPORT_HOURS} hours, because we cannot tell what happened to the item once it has been with you for longer than that.`,
    ],
  },
];
