import { createFileRoute } from "@tanstack/react-router";
import { PoolConfigurator } from "@/components/pool/PoolConfigurator";
import { useEffect } from "react";
import { useI18n } from "@/lib/i18n";

const title = "Pool Studio — Configuratore piscine 3D";
const description =
  "Configura la tua piscina in 3D in tempo reale: scegli tipologia, forma e dimensioni, con calcolo immediato di volume e superfici.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { locale } = useI18n();
  const heading = locale === "en" ? "3D Pool Configurator" : "Configuratore piscine 3D";
  useEffect(() => { document.title = `Pool Studio — ${heading}`; }, [heading]);
  return (
    <>
      <h1 className="sr-only">{heading}</h1>
      <PoolConfigurator />
    </>
  );
}
