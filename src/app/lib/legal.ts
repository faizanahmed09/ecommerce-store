/*
 * ---------------------------------------------------------
 * LEGAL PAGES
 * ---------------------------------------------------------
 *
 * Privacy, Terms and Shipping, kept out of the components so
 * the wording can change without touching layout - the same
 * shape returns-policy.ts uses.
 *
 * THESE ARE DRAFTS, NOT LEGAL ADVICE. They describe what this
 * codebase actually does, which is the honest starting point,
 * but a lawyer should read them before you rely on them - and
 * a payment gateway or an ad platform reviewing your account
 * will read them too.
 */

import type { PolicyDocument } from "@/src/app/lib/policy";
import { STORE_ADDRESS, STORE_EMAIL } from "@/src/app/lib/store-contact";
import { EXCHANGE_WINDOW_DAYS } from "@/src/app/lib/returns-policy";
import { FREE_SHIPPING_LABEL, SHIPPING_FEE } from "@/src/app/lib/order-totals";
import { formatCurrency } from "@/src/app/lib/utils";

/* Shown as "last updated" - bump when the wording changes. */
export const LEGAL_UPDATED = "September 2026";

export const PRIVACY_POLICY: PolicyDocument = {
  title: "Privacy Policy",
  intro:
    "This explains what we collect when you shop with us, why we hold it, and what you can ask us to do with it.",
  sections: [
    {
      title: "What we collect",
      body: ["Only what an order needs, and only when you give it to us:"],
      points: [
        "Your name, delivery address, phone number and email, so we can deliver and reach you about the order.",
        "What you ordered, and what you paid.",
        "If you create an account: your email and an encrypted password. We never see the password itself.",
        "Basic, anonymous usage data about which pages are visited, so we can tell what is slow or broken.",
      ],
    },
    {
      title: "What we do not collect",
      body: [
        "We do not take card details. Orders are cash on delivery, so no payment information is entered on this site or held by us.",
        "We do not buy personal data from anyone, and we do not sell yours.",
      ],
    },
    {
      title: "Why we hold it",
      points: [
        "To pick, pack and deliver what you ordered.",
        "To answer you when you contact us about an order.",
        "To handle an exchange or a complaint.",
        "To meet our tax and accounting obligations.",
      ],
    },
    {
      title: "Who else sees it",
      body: [
        "Your name, address and phone go to the courier carrying your parcel — they cannot deliver without them.",
        "Our website and database are hosted by service providers on our behalf. They process data under our instruction and do not use it for anything else.",
        "We share nothing with advertisers or data brokers.",
      ],
    },
    {
      title: "How long we keep it",
      body: [
        "Order records are kept as long as we are required to for accounting purposes. Account details are kept until you ask us to close the account.",
      ],
    },
    {
      title: "Your choices",
      body: ["Write to us and you can ask us to:"],
      points: [
        "Send you a copy of what we hold about you.",
        "Correct anything that is wrong.",
        "Delete your account and the data attached to it, where we are not required to keep it.",
        "Stop emailing you about anything other than an order you have placed.",
      ],
    },
    {
      title: "Cookies",
      body: [
        "We use the minimum a shop needs: one to keep you signed in, and one to remember your basket between visits. Turning them off will break the cart.",
      ],
    },
    {
      title: "Contact",
      body: [
        `Questions about any of this go to ${STORE_EMAIL}. Our registered address is ${STORE_ADDRESS}.`,
      ],
    },
  ],
};

export const TERMS_OF_SERVICE: PolicyDocument = {
  title: "Terms of Service",
  intro:
    "The terms you agree to when you order from us. Please read them — placing an order means accepting them.",
  sections: [
    {
      title: "Ordering",
      body: [
        "Placing an order is an offer to buy, not a completed sale. The sale is made when we accept the order and dispatch it.",
        "We may decline an order — if an item has sold out, if we cannot deliver to the address, or if we believe the order is not genuine. If we decline one you have already paid for, you get the money back.",
      ],
    },
    {
      title: "Prices and availability",
      body: [
        "Prices are in Pakistani Rupees and include applicable taxes unless stated otherwise.",
        "Stock shown on the site is our best current figure. If something sells out between your order and our packing it, we will contact you to arrange a replacement or a refund of that item.",
        "We correct pricing errors when we find them. If an item was listed at an obviously wrong price, we will contact you before dispatch rather than simply charging it.",
      ],
    },
    {
      title: "Delivery",
      body: [
        `Delivery is ${formatCurrency(SHIPPING_FEE)}, and free on orders over ${FREE_SHIPPING_LABEL}.`,
        "Delivery times are estimates. We are not able to guarantee a date, because the parcel is with a courier for most of its journey.",
      ],
    },
    {
      title: "Returns and exchanges",
      body: [
        `Items can be exchanged within ${EXCHANGE_WINDOW_DAYS} days of delivery, subject to condition. The full terms are on our Returns & Exchanges page, and they form part of these terms.`,
      ],
    },
    {
      title: "Your account",
      body: [
        "You are responsible for keeping your password to yourself, and for anything done through your account.",
        "Tell us straight away if you think someone else has access to it.",
      ],
    },
    {
      title: "Acceptable use",
      body: ["When using this site, please do not:"],
      points: [
        "Place orders you do not intend to accept.",
        "Attempt to access accounts, orders or data that are not yours.",
        "Copy our photographs or descriptions for another shop.",
        "Automate requests in a way that degrades the site for other people.",
      ],
    },
    {
      title: "Our liability",
      body: [
        "We are responsible for delivering what you ordered, in the condition described. We are not liable for losses beyond that which we could not reasonably have foreseen.",
        "Nothing here removes rights you have under Pakistani consumer law.",
      ],
    },
    {
      title: "Changes",
      body: [
        "We may update these terms. The version in force is the one published here when you place your order.",
      ],
    },
  ],
};

export const SHIPPING_POLICY: PolicyDocument = {
  title: "Shipping Policy",
  intro: "What delivery costs, how long it takes, and where we send to.",
  sections: [
    {
      title: "Cost",
      body: [
        `Delivery is a flat ${formatCurrency(SHIPPING_FEE)} anywhere in Pakistan, and free on orders over ${FREE_SHIPPING_LABEL}.`,
        "The charge is shown in your basket before you confirm, so nothing is added at the last step.",
      ],
    },
    {
      title: "How long it takes",
      body: [
        "Orders are usually packed within one to two working days. Delivery then depends on the courier and where you are — typically two to five working days in major cities, and longer elsewhere.",
        "Orders placed on a weekend or a public holiday are packed the next working day.",
      ],
    },
    {
      title: "Where we deliver",
      body: ["We deliver across Pakistan. We do not currently ship internationally."],
    },
    {
      title: "Paying",
      body: [
        "Orders are cash on delivery. Please have the exact amount ready for the courier — they may not carry change.",
      ],
    },
    {
      title: "Tracking",
      body: [
        "You will get an order number when you check out. Use it, with the email you ordered with, on our Track Order page to see where your order has reached.",
      ],
    },
    {
      title: "If something goes wrong",
      body: [
        "If a parcel arrives damaged, is missing items, or does not arrive at all, contact us with your order number and we will chase the courier.",
      ],
    },
  ],
};
