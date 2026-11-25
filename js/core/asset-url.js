// GitHack redirige los recursos estáticos a GitHub sin CORS en el salto.
// La ruta conserva el repositorio y el SHA. En local se usa el servidor del proyecto.
export function assetUrl(relativePath, moduleUrl) {
  const resource = new URL(relativePath, moduleUrl);
  // Cambia sólo el host para conservar la revisión y los segmentos de ruta ya resueltos.
  if (resource.hostname === 'rawcdn.githack.com') {
    resource.hostname = 'raw.githubusercontent.com';
  }
  return resource;
}
