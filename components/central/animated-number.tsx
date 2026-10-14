"use client";

import { animate, useMotionValue, useTransform, motion } from "motion/react";
import { useEffect } from "react";

export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest).toLocaleString("pt-BR"));

  useEffect(() => {
    const controls = animate(count, value, { duration: 0.9, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [count, value]);

  return <motion.span className={className}>{rounded}</motion.span>;
}
