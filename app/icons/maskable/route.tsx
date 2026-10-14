import { renderAppIcon } from "@/lib/brand/icon-image";

export function GET() {
  return renderAppIcon(512, { maskable: true });
}
