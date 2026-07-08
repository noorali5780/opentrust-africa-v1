import type { ReactNode } from "react";
import { ConsoleProvider } from "@/features/console/console-context";
import { ConsoleShell } from "@/features/console/console-shell";

export default function ConsoleLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <ConsoleProvider>
      <ConsoleShell>{children}</ConsoleShell>
    </ConsoleProvider>
  );
}
