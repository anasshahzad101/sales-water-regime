/** "PKR 7,392.3M", "PKR 450K", "PKR 980" — amounts are stored in rupees. */
export function money(pkr: number | null | undefined): string {
  if (pkr == null) return "—";
  const m = pkr / 1_000_000;
  if (Math.abs(m) >= 1) return `PKR ${m.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
  if (Math.abs(pkr) >= 1000) return `PKR ${Math.round(pkr / 1000)}K`;
  return `PKR ${Math.round(pkr).toLocaleString("en-US")}`;
}

/** "PKR 86,500,000" */
export function moneyFull(pkr: number | null | undefined): string {
  if (pkr == null) return "—";
  return `PKR ${Math.round(pkr).toLocaleString("en-US")}`;
}

/** Compact number for axes: "1.2B", "450M" */
export function moneyShort(pkr: number): string {
  if (pkr >= 1e9) return `${(pkr / 1e9).toFixed(1)}B`;
  if (pkr >= 1e6) return `${Math.round(pkr / 1e6)}M`;
  if (pkr >= 1e3) return `${Math.round(pkr / 1e3)}K`;
  return String(Math.round(pkr));
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Digits-only phone for tel: and wa.me links ("+92 300 8421 557" → "923008421557"). */
export function phoneDigits(phone: string): string {
  let d = phone.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = `92${d.slice(1)}`;
  return d;
}

export function telHref(phone: string) {
  return `tel:+${phoneDigits(phone)}`;
}

export function whatsappHref(phone: string) {
  return `https://wa.me/${phoneDigits(phone)}`;
}

export function websiteHref(site: string) {
  return /^https?:\/\//i.test(site) ? site : `https://${site}`;
}
