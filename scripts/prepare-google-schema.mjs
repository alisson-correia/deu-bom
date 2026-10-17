// Explicit, temporary deployment flag; normal builds and CI do not migrate data.
if (process.env.GOOGLE_SCHEMA_AUTO_MIGRATE === '1') {
  await import('./apply-google-migration.mjs');
  if (process.exitCode) throw new Error('Não foi possível preparar a integração Google.');
}
