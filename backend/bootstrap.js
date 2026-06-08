const modules = [
  './contestIdFallbackPatch.js',
  './entryCancelPatch.js',
  './server.js',
];

for (const modulePath of modules) {
  await import(modulePath);
}
