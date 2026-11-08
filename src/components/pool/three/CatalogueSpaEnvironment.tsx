import { useLayoutEffect, type ComponentProps } from "react";
import { useLoader, useThree } from "@react-three/fiber";
import { EquirectangularReflectionMapping } from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { CATALOGUE_GARDEN } from "@/lib/pool/catalogue-garden";
import { DaylightEnvironment } from "./DaylightEnvironment";

/** The room retains its own reflection probe. Only the visible distant sky
 * uses the photographic garden, without another mesh or an extra render pass.
 */
export function CatalogueSpaEnvironment({
  rotation,
  ...props
}: ComponentProps<typeof DaylightEnvironment> & { rotation: number }) {
  const { scene } = useThree();
  const map = useLoader(HDRLoader, CATALOGUE_GARDEN.url);
  map.mapping = EquirectangularReflectionMapping;
  const day = props.timeOfDay !== "night";
  const show = props.showBackdrop ?? true;
  useLayoutEffect(() => {
    if (!day || !show) return;
    const previous = scene.background;
    const previousRotation = scene.backgroundRotation.clone();
    const previousIntensity = scene.backgroundIntensity;
    scene.background = map;
    scene.backgroundRotation.set(0, rotation, 0);
    scene.backgroundIntensity = 1;
    return () => {
      // A later owner, such as Photo Mode, must never be overwritten here.
      if (scene.background !== map) return;
      scene.background = previous;
      scene.backgroundRotation.copy(previousRotation);
      scene.backgroundIntensity = previousIntensity;
    };
  }, [scene, map, rotation, day, show]);
  return <DaylightEnvironment {...props} showBackdrop={day ? false : show} />;
}
