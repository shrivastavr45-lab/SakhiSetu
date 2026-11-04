import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { NEEDS, type Scheme } from "@/lib/data";
import { useLang } from "@/lib/i18n";

export function SchemeCard({ s }: { s: Scheme }) {
  const { t } = useLang();
  const need = NEEDS.find((n) => n.id === s.need)!;
  return (
    <Link to="/schemes/$id" params={{ id: s.id }} className="card-soft p-5 flex flex-col gap-3 hover:-translate-y-0.5 transition-transform">
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm">
        <span aria-hidden>{need.icon}</span> {t(need.name)}
      </span>
      <h3 className="text-xl">{t(s.name)}</h3>
      <p className="text-muted-foreground">{t(s.short)}</p>
      <p className="rounded-lg bg-leaf-soft px-3 py-2 font-semibold text-leaf">{t(s.benefit)}</p>
      <span className="mt-auto inline-flex items-center gap-1 font-semibold text-primary">
        {t({ hi: "पूरी जानकारी", en: "Full details" })} <ArrowRight className="size-4" />
      </span>
    </Link>
  );
}
