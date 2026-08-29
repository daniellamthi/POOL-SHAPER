import { EffectComposer, SSAO, Bloom, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";

/**
 * Experience-tier post pass, split into its own chunk and loaded via
 * React.lazy() so the (non-trivial) postprocessing library is only ever
 * downloaded when a viewer actually runs the Experience quality tier.
 * Configuration -- today's default -- never fetches this module.
 *
 * Single ACES source of truth: the Canvas only switches its renderer to
 * NoToneMapping when this component is mounted (see PoolScene.tsx), so the
 * scene reaches this composer as linear HDR and ACES is applied exactly once,
 * here. Do not also set toneMapping on the renderer while this is active.
 *
 * Deliberately subtle: gentle contact AO (world-space distance cutoff so it
 * can't bridge across the waterline's depth discontinuity into a dark ring),
 * bloom only on genuine bright highlights/caustics, ACES last.
 */
export default function PremiumPostFX() {
  return (
    <EffectComposer multisampling={0} enableNormalPass>
      <SSAO
        samples={16}
        radius={0.15}
        intensity={0.6}
        luminanceInfluence={0.75}
        bias={0.035}
        fade={0.02}
        worldDistanceThreshold={0.6}
        worldDistanceFalloff={0.25}
        worldProximityThreshold={0.06}
        worldProximityFalloff={0.03}
      />
      <Bloom luminanceThreshold={0.95} luminanceSmoothing={0.03} intensity={0.28} mipmapBlur />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
