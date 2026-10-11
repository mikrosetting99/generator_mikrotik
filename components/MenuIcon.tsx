import { Cpu, Database, FileText, Lock, Route, Shield, Split, Terminal, Users, Wand } from "@/components/icons";
import type { MenuIconName } from "@/lib/site-settings";

const ICONS: Record<MenuIconName, typeof Cpu> = {
  cpu: Cpu,
  split: Split,
  filetext: FileText,
  shield: Shield,
  terminal: Terminal,
  route: Route,
  wand: Wand,
  database: Database,
  users: Users,
  lock: Lock,
};

export function MenuIcon({ name, className }: { name: MenuIconName; className?: string }) {
  const Glyph = ICONS[name] ?? Terminal;
  return <Glyph className={className} />;
}
