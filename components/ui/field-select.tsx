"use client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

export function FieldSelect({
  label,
  options,
  className,
  ...props
}: {
  label: string;
  options: { value: string; label: string }[];
  className?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <Select {...props}>
      <SelectTrigger
        aria-label={label}
        className={`h-10! w-full min-w-0 ${className ?? ""}`}
      >
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent position="popper" className="max-h-72">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="min-h-9 py-2">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
