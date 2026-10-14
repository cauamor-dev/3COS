import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "cn";

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("markdown", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
