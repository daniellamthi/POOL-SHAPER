import { PROJECT_TYPES } from "@/lib/pool/config";
import { useConfigurator } from "@/lib/pool/context";
import { OptionCard, StepSection } from "@/components/pool/StepSection";

/**
 * Step 1 — identifies whether the project is a new build or a renovation.
 *
 * State ownership stays in the configurator store so the selection remains
 * available to every later step without coupling this module to navigation.
 */
export function ProjectTypeStep() {
  const { config, setProjectType } = useConfigurator();

  return (
    <StepSection title="Tipo di progetto" subtitle="Indicaci la natura dell'intervento.">
      <div className="grid gap-4" role="group" aria-label="Tipo di progetto">
        {PROJECT_TYPES.map((projectType) => (
          <OptionCard
            key={projectType.id}
            title={projectType.title}
            description={projectType.description}
            selected={config.projectType === projectType.id}
            onSelect={() => setProjectType(projectType.id)}
          />
        ))}
      </div>
    </StepSection>
  );
}
