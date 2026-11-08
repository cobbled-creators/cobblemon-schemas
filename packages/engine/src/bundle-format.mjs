// The contract between a schema package's dist/bundle.json and this engine. Bump the format only when
// an engine that reads the old one would misread the new one; fields old engines can ignore don't count.
export const BUNDLE_FORMAT_VERSION = 1;
export const SUPPORTED_BUNDLE_FORMATS = Object.freeze([BUNDLE_FORMAT_VERSION]);

export function checkBundle(bundle, validators) {
  if (!SUPPORTED_BUNDLE_FORMATS.includes(bundle?.formatVersion)) {
    throw bundleError(
      'ERR_COBBLEMON_BUNDLE_FORMAT',
      `Unsupported schema bundle format ${bundle?.formatVersion ?? 'none'} (${describePackage(bundle)}); ` +
        `this engine reads format ${SUPPORTED_BUNDLE_FORMATS.join(', ')}. ` +
        'Install the latest @cobbled-creators/cobblemon-validator and @cobbled-creators/cobblemon-schemas.',
    );
  }
  for (const entry of bundle.entries) {
    if (entry.validator && typeof validators?.[entry.validator] !== 'function') {
      throw bundleError(
        'ERR_COBBLEMON_BUNDLE_MISMATCH',
        `The validators module has no ${entry.validator} for ${entry.path} (${describePackage(bundle)}): ` +
          'the bundle and validators.mjs come from different builds.',
      );
    }
  }
}

function describePackage(bundle) {
  const pkg = bundle?.package;
  if (pkg && typeof pkg === 'object') return `${pkg.name} ${pkg.version}`;
  if (typeof pkg === 'string') return `@cobbled-creators/cobblemon-schemas ${pkg}`;
  return 'unknown package';
}

function bundleError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
