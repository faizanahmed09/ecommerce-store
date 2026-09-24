/*
 * ---------------------------------------------------------
 * STORE CONTACT DETAILS
 * ---------------------------------------------------------
 *
 * One place for how customers reach the shop, because the
 * footer, the contact page and the WhatsApp button all need
 * the same number and must never disagree.
 *
 * The values come from NEXT_PUBLIC_* environment variables so
 * they can differ between a staging shop and the real one.
 * The fallbacks are the placeholders the footer already
 * carried - replace them in .env before launch, or customers
 * will message a number that is not yours.
 */

/* Digits only, with country code and no '+' - what wa.me expects. */
export const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "923001234567";

export const STORE_PHONE = process.env.NEXT_PUBLIC_STORE_PHONE ?? "+92 300 123 4567";

export const STORE_EMAIL = process.env.NEXT_PUBLIC_STORE_EMAIL ?? "support@lamees.com";

/*
 * The address as configured. "|" separates the lines the footer
 * prints; a value without one is simply a single line.
 */
const RAW_STORE_ADDRESS = process.env.NEXT_PUBLIC_STORE_ADDRESS ?? "Karachi, Sindh, Pakistan";

/*
 * One line per "|"-separated part, for the footer's block.
 *
 * A postal address is two or three lines, and no host's
 * dashboard carries a real line break through an env var
 * reliably - hence the separator.
 */
export const STORE_ADDRESS_LINES = RAW_STORE_ADDRESS.split("|")
  .map((line) => line.trim())
  .filter(Boolean);

/*
 * The same address on one line, for prose - the contact page
 * and the privacy policy both drop it into a sentence, where a
 * "|" would be visible to the customer.
 */
export const STORE_ADDRESS = STORE_ADDRESS_LINES.join(", ");

export const STORE_HOURS =
  process.env.NEXT_PUBLIC_STORE_HOURS ?? "Monday to Saturday, 10am - 8pm (PKT)";

/*
 * ---------------------------------------------------------
 * SOCIAL PROFILES
 * ---------------------------------------------------------
 *
 * Every one of these was hard-coded to the platform's own
 * homepage - facebook.com, instagram.com - so the footer's
 * icons sent customers to Facebook rather than to the shop.
 * An unset profile is now left out of the footer entirely,
 * because no icon is better than one that goes nowhere useful.
 */
export interface SocialProfile {
  label: string;
  href: string;
}

const socialEnv: { label: string; url: string | undefined }[] = [
  { label: "Facebook", url: process.env.NEXT_PUBLIC_FACEBOOK_URL },
  { label: "Instagram", url: process.env.NEXT_PUBLIC_INSTAGRAM_URL },
  { label: "TikTok", url: process.env.NEXT_PUBLIC_TIKTOK_URL },
  { label: "YouTube", url: process.env.NEXT_PUBLIC_YOUTUBE_URL },
];

export const SOCIAL_PROFILES: SocialProfile[] = socialEnv
  .filter((entry): entry is { label: string; url: string } => Boolean(entry.url?.trim()))
  .map((entry) => ({ label: entry.label, href: entry.url.trim() }));

/**
 * A wa.me link, optionally opening the chat with a message
 * already typed.
 *
 * wa.me works on desktop and mobile and needs no app id, which
 * is why it is used here rather than the api.whatsapp.com form.
 */
export function whatsappHref(message?: string): string {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;

  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/* Digits only, so the number can also be dialled. */
export const telHref = `tel:${STORE_PHONE.replace(/[^\d+]/g, "")}`;

export const mailtoHref = `mailto:${STORE_EMAIL}`;
