/*
 * ---------------------------------------------------------
 * FREQUENTLY ASKED QUESTIONS
 * ---------------------------------------------------------
 *
 * The answers quote the same constants the checkout, the
 * shipping policy and the returns policy run on, so changing a
 * fee or a window in one place changes it here too. An FAQ that
 * says delivery is free over one amount while the basket
 * charges at another is how a customer ends up feeling misled.
 *
 * Answers are plain strings because the same text is sent to
 * search engines as FAQPage structured data.
 */

import { FREE_SHIPPING_LABEL, SHIPPING_FEE } from "@/src/app/lib/order-totals";
import {
  DEFECT_REPORT_HOURS,
  EXCHANGE_WINDOW_DAYS,
  FINAL_SALE_DISCOUNT_PERCENT,
} from "@/src/app/lib/returns-policy";
import { SIZES } from "@/src/app/lib/size-guide";
import { STORE_HOURS } from "@/src/app/lib/store-contact";
import { formatCurrency } from "@/src/app/lib/utils";

export interface Faq {
  question: string;
  answer: string;
}

export interface FaqGroup {
  /* Anchor id, so a group can be linked to directly. */
  id: string;
  title: string;
  items: Faq[];
}

export const FAQ_GROUPS: FaqGroup[] = [
  {
    id: "orders",
    title: "Orders & payment",
    items: [
      {
        question: "How do I place an order?",
        answer:
          "Choose your size, add the piece to your bag and check out with your name, phone number and delivery address. You will get an order number on screen and by email once the order is placed.",
      },
      {
        question: "Do I need an account to order?",
        answer:
          "No. You can check out as a guest. An account simply keeps your addresses, wishlist and order history in one place.",
      },
      {
        question: "Which payment methods do you accept?",
        answer:
          "All orders are cash on delivery - you pay the courier when your parcel arrives. Please keep the exact amount ready, as couriers may not carry change.",
      },
      {
        question: "Can I use a discount code?",
        answer:
          "Yes. Enter the code at checkout and the discount is applied to your order total before you confirm.",
      },
      {
        question: "Can I change or cancel my order?",
        answer:
          "Message us on WhatsApp with your order number as soon as possible. If the order has not been handed to the courier yet, we can change or cancel it.",
      },
    ],
  },
  {
    id: "shipping",
    title: "Shipping & delivery",
    items: [
      {
        question: "How much does delivery cost?",
        answer: `Delivery is a flat ${formatCurrency(SHIPPING_FEE)} anywhere in Pakistan, and free on orders over ${FREE_SHIPPING_LABEL}.`,
      },
      {
        question: "How long will my order take to arrive?",
        answer:
          "Orders are usually packed within one to two working days. Delivery then typically takes two to five working days in major cities, and a little longer in other areas.",
      },
      {
        question: "Do you deliver all over Pakistan?",
        answer:
          "Yes, we deliver to cities and towns across Pakistan. We do not currently ship internationally.",
      },
      {
        question: "How can I track my order?",
        answer:
          "Use the Track Order page with your order number and the email you ordered with. Both are on your confirmation email. If you have an account, your orders are also listed there.",
      },
    ],
  },
  {
    id: "returns",
    title: "Exchanges & returns",
    items: [
      {
        question: "Can I exchange a dress if it does not fit?",
        answer: `Yes. You can request an exchange within ${EXCHANGE_WINDOW_DAYS} days of delivery for a different size or colour, as long as the piece is unworn, unwashed and still has its tags and packaging.`,
      },
      {
        question: "Do you give cash refunds?",
        answer:
          "We do not refund to cash. If the size or colour you want is not available, we issue store credit for the amount you paid, which you can spend on any future order.",
      },
      {
        question: "What if my item arrives damaged or wrong?",
        answer: `Tell us within ${DEFECT_REPORT_HOURS} hours of delivery, with photographs of the item, its tags and the packaging. For a faulty or wrong item we cover the return postage.`,
      },
      {
        question: "Can sale items be exchanged?",
        answer: `Items bought at up to ${FINAL_SALE_DISCOUNT_PERCENT}% off can be exchanged like any other. Items bought at more than ${FINAL_SALE_DISCOUNT_PERCENT}% off, or in a sale marked final at checkout, cannot be exchanged.`,
      },
    ],
  },
  {
    id: "products",
    title: "Products & sizing",
    items: [
      {
        question: "What is the difference between stitched and unstitched suits?",
        answer:
          "A stitched (ready to wear) suit arrives tailored and ready to wear in your size. An unstitched suit is the fabric - usually shirt, trouser and dupatta - for you to have tailored to your own measurements and style.",
      },
      {
        question: "What does a 3-piece suit include?",
        answer:
          "A 3-piece suit includes a shirt, a trouser and a dupatta. A 2-piece suit usually includes the shirt with either a trouser or a dupatta - each product page lists exactly what is included.",
      },
      {
        question: "How do I choose my size?",
        answer: `Stitched pieces come in sizes ${SIZES.join(", ")}. Open the Size guide on any product page to compare the garment measurements with a piece you already own.`,
      },
      {
        question: "Will the colour look the same as in the photos?",
        answer:
          "We photograph every piece to show its true colour, but screens vary and embroidery can catch the light differently, so there may be a slight difference in person.",
      },
      {
        question: "How should I care for embroidered clothes?",
        answer:
          "Hand wash or gentle machine wash in cold water, inside out, and avoid soaking. Iron on the reverse side and keep heavy embroidery away from direct heat. Follow any care label on the piece.",
      },
    ],
  },
  {
    id: "contact",
    title: "Contact",
    items: [
      {
        question: "How can I contact Lamees?",
        answer: `WhatsApp is the fastest way to reach us, and you can also call or email. We are available ${STORE_HOURS}.`,
      },
    ],
  },
];
