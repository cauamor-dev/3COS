import { operations, type Operation } from "@/lib/central/operations";

export interface MatchedOperation {
  operation: Operation;
  pathParams: Record<string, string>;
}

export function matchOperation(method: string, segments: string[]): MatchedOperation | null {
  for (const operation of operations) {
    if (operation.http.method !== method) continue;
    const template = operation.http.path.split("/").filter(Boolean);
    if (template.length !== segments.length) continue;

    const pathParams: Record<string, string> = {};
    const matches = template.every((part, index) => {
      const param = part.match(/^\{(.+)\}$/);
      if (param) {
        pathParams[param[1]] = decodeURIComponent(segments[index]);
        return true;
      }
      return part === segments[index];
    });
    if (matches) return { operation, pathParams };
  }
  return null;
}

export function allowedMethods(segments: string[]): string[] {
  return ["GET", "POST", "PUT", "PATCH"].filter((method) => matchOperation(method, segments));
}
