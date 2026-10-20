import { useEffect, useMemo, type ReactElement, type ReactNode } from "react";
import type { ThreeElements } from "@react-three/fiber";
import { MeshPhysicalMaterial } from "three";

/** Keep the compiled finished material while a construction-stage material is
 * attached. Only one is rendered. Primitives are not auto-disposed by R3F, so
 * this owner releases the material on a shader-variant change or true unmount. */
export function RetainedStageMaterial({ raw, programKey, children }: {
  raw: ReactNode;
  programKey: string;
  children: ReactElement<ThreeElements["meshPhysicalMaterial"]>;
}) {
  const material = useMemo(() => new MeshPhysicalMaterial(), [programKey]);
  useEffect(() => () => material.dispose(), [material]);
  return raw ?? <primitive {...children.props} object={material} attach="material" />;
}
