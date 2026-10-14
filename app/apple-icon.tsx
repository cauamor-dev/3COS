import { renderAppIcon } from "@/lib/brand/icon-image";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return renderAppIcon(180, { maskable: true });
}
