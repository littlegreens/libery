/**
 * Asset statici in `client/public/`.
 * - Logo → `public/logo.png`
 * - UI → `public/icons/*.svg`
 * - Pin mappa → `public/map/pins/*_pin.svg`
 */
export const icons = {
  camera: '/icons/camera.svg',
  menu: '/icons/sidebar_botton.svg',
  logo: '/logo.png',
  book: '/icons/bilbio.svg',
  libreria: '/icons/libreria.svg',
  corner: '/icons/corner.svg',
} as const;

export const mapPins = {
  biblioteca: '/map/pins/biblioteca_pin.svg',
  libreria: '/map/pins/libreria_pin.svg',
  corner_free: '/map/pins/corner_pin.svg',
} as const;
