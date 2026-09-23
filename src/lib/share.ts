/** Share helpers: open WhatsApp/email with a pre-filled message. Nothing is sent without the user's action. */

export function whatsappLink(mobile: string | null | undefined, text: string) {
  const digits = (mobile ?? "").replace(/\D/g, "");
  const phone = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export function mailtoLink(email: string | null | undefined, subject: string, body: string) {
  return `mailto:${email ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
