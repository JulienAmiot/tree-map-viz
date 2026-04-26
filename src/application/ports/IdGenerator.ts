/**
 * Application port: opaque uuid/string id generator.
 *
 * Concrete adapters live under `src/adapters/system/` and bind to e.g.
 * `crypto.randomUUID()`. Tests inject deterministic stubs.
 *
 * Encoded as a plain callable type so test stubs are zero-ceremony:
 *     const idGen: IdGenerator = (() => { let n = 0; return () => `id-${++n}`; })();
 */
export type IdGenerator = () => string;
