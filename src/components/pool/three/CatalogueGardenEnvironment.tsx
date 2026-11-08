import { Environment } from "@react-three/drei";
import { useLoader } from "@react-three/fiber";
import { EquirectangularReflectionMapping } from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { CATALOGUE_GARDEN } from "@/lib/pool/catalogue-garden";

/** One bounded cached capture for the garden, its reflections and daylight.
 * Night/technical/photo-studio views keep their existing environments.
 */
export function CatalogueGardenEnvironment({ rotation }: { rotation: number }) {
  const map = useLoader(HDRLoader, CATALOGUE_GARDEN.url);
  map.mapping = EquirectangularReflectionMapping;
  return (
    <Environment
      map={map}
      background
      environmentRotation={[0, rotation, 0]}
      backgroundRotation={[0, rotation, 0]}
      environmentIntensity={CATALOGUE_GARDEN.environmentIntensity}
    />
  );
}
