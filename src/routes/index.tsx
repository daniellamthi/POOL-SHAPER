import { createFileRoute } from "@tanstack/react-router";
import { PoolConfigurator } from "@/components/pool/PoolConfigurator";

const title = "Pool Studio — 3D Swimming Pool Configurator";
const description =
  "Design your swimming pool in real time 3D: choose project type, shape and dimensions, with instant volume and surface calculations.";

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
  return (
    <>
      <h1 className="sr-only">3D Swimming Pool Configurator</h1>
      <PoolConfigurator />
    </>
  );
}
