// Ícone de cada categoria de peça (lucide, traço 1.75). Emojis não são ícones.

import { CircuitBoard, Cpu, Gpu, HardDrive, MemoryStick, PcCase, Zap } from "lucide-react";
import type { Category } from "@/models/types";

const ICONS: Record<Category, typeof Cpu> = {
  gpu: Gpu,
  cpu: Cpu,
  ram: MemoryStick,
  ssd: HardDrive,
  motherboard: CircuitBoard,
  psu: Zap,
  case: PcCase,
};

export function CategoryIcon({ category, className = "h-4 w-4" }: { category: Category; className?: string }) {
  const Icon = ICONS[category] ?? Cpu;
  return <Icon className={className} strokeWidth={1.75} aria-hidden />;
}
