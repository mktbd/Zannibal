/**
 * Shared class strings for Admin controls, so buttons/inputs look the same
 * on every CMS screen. Plain strings rather than a component library: the
 * Admin is deliberately small (MKTBD_SPEC.md section 13).
 */

const buttonBase =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export const buttonPrimary = `${buttonBase} border-black bg-black text-white hover:bg-near-black/85`;

export const buttonSecondary = `${buttonBase} border-light-grey bg-white text-black hover:border-black`;

export const buttonDanger = `${buttonBase} border-red-700 bg-white text-red-700 hover:bg-red-700 hover:text-white`;

/** Text-style action used inside table rows. */
export const linkButton =
  "rounded-sm text-sm font-medium underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline";

export const textInput =
  "w-full rounded-sm border border-light-grey bg-white px-3 py-1.5 text-sm placeholder:text-muted hover:border-muted focus:border-black aria-[invalid=true]:border-red-700";
