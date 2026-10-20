/** WhatsApp deep link: opens the app on phones and WhatsApp Web on desktop. Indian numbers only. */
export function whatsappLink(phone: string, text?: string): string {
  const url = new URL(`https://wa.me/91${phone}`);
  if (text) url.searchParams.set('text', text);
  return url.toString();
}

export const formatIndianPhone = (p: string) => `+91 ${p.slice(0, 5)} ${p.slice(5)}`;
