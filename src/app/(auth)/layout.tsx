import { CenteredShell } from "@/components/brand";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return <CenteredShell>{children}</CenteredShell>;
}
