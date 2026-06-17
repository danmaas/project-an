import { defineConfig } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.resolve(__dirname, '..', 'data')
const PORT = process.env.E2E_PORT ?? '8001'
const IMAGE = process.env.E2E_IMAGE ?? 'project-an'
export const CONTAINER_NAME = process.env.E2E_CONTAINER ?? 'project-an-e2e'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  globalTeardown: './global-teardown.ts',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
  },
  // The webServer command launches the built Docker image with a known name,
  // mounts the repo's data/ directory at /data, and exposes :8000 on $PORT.
  //
  // Three reliability tricks:
  //  - Pre-cleanup (`docker rm -f`) inside the same shell command removes any
  //    stale container from a previous run before starting a new one. This is
  //    done here (not in globalSetup) because Playwright runs globalSetup in
  //    parallel with webServer — a globalSetup `rm -f` would race and kill the
  //    fresh container.
  //  - `exec` replaces the shell with the docker CLI so signals from Playwright
  //    propagate directly to docker (which forwards them to the container).
  //  - `--name` gives globalTeardown a stable handle to force-remove the
  //    container if signal-based shutdown fails.
  webServer: {
    command:
      `sh -c 'docker rm -f ${CONTAINER_NAME} >/dev/null 2>&1 || true; ` +
      `exec docker run --rm --name ${CONTAINER_NAME} ` +
      `-p ${PORT}:8000 -v ${dataDir}:/data ${IMAGE}'`,
    url: `http://127.0.0.1:${PORT}/healthz`,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
