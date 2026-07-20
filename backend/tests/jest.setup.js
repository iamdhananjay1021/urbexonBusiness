/**
 * tests/jest.setup.js — loaded via Jest's `setupFiles`, before any test
 * file (and therefore before any of its imports) is evaluated.
 *
 * Fixes a real ordering bug: helpers.js calls dotenv.config({path:
 * ".env.test"}) at its own top level, but ES module imports are hoisted —
 * every test file's `import {...} from "./helpers.js"` transitively pulls
 * in authRoutes.js -> authMiddleware.js (which throws if JWT_SECRET is
 * unset) BEFORE helpers.js's own dotenv.config() line ever runs, since all
 * static imports across the whole module graph resolve before any
 * module's own top-level code executes. Loading env vars here, in a
 * dedicated setup phase that runs strictly before the test module graph is
 * loaded, is the correct fix rather than reordering imports (which
 * wouldn't help — hoisting still wins).
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.test" });
