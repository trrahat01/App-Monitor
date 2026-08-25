/**
 * Root entry point for Render.
 *
 * Render runs `node --experimental-transform-types src/index.ts` from the repo
 * root. This file simply boots the real API server located in
 * artifacts/api-server/src/index.ts. All of that server's relative imports
 * resolve relative to its own file, so they work unchanged.
 */
import "../artifacts/api-server/src/index.ts";