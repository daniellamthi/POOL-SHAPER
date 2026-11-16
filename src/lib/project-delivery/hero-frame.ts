/** The Project Book cover and Day/Night images use the same landscape crop.
 * Fit the real configured subject inside this area before taking the image,
 * not inside a portrait canvas whose top/bottom will subsequently be removed. */
export function projectBookHeroFrame(width: number, height: number) {
  const cropWidth = Math.min(width, height * (297 / 150));
  const cropHeight = cropWidth / (297 / 150);
  return {
    left: (width - cropWidth) / 2,
    top: (height - cropHeight) / 2,
    width: cropWidth,
    height: cropHeight,
  };
}
