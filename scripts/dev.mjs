import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rendererPort = 5173;
const rendererUrl = `http://127.0.0.1:${rendererPort}`;
const require = createRequire(import.meta.url);
const electronCommand = require("electron");
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viteBin = path.join(rootDir, "node_modules", "vite", "bin", "vite.js");

const renderer = spawn(
  process.execPath,
  [viteBin, "--host", "127.0.0.1", "--port", String(rendererPort)],
  {
    cwd: rootDir,
    stdio: "inherit",
    shell: false
  }
);

/*
const renderer = spawn(npmCommand, ["run", "dev:renderer", "--", "--port", String(rendererPort)], {
  stdio: "inherit",
  shell: true
});
*/

let electronProcess;
let shuttingDown = false;

waitForServer(rendererUrl)
  .then(() => {
    electronProcess = spawn(electronCommand, ["."], {
      cwd: rootDir,
      stdio: "inherit",
      shell: false,
      env: {
        ...process.env,
        VITE_DEV_SERVER_URL: rendererUrl
      }
    });

    electronProcess.on("exit", (code) => {
      shutdown(code ?? 0);
    });
  })
  .catch((error) => {
    console.error(error);
    shutdown(1);
  });

renderer.on("exit", (code) => {
  if (!shuttingDown) {
    shutdown(code ?? 0);
  }
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

function waitForServer(url) {
  const started = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });

      request.on("error", () => {
        if (Date.now() - started > 30000) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }

        setTimeout(check, 250);
      });
    };

    check();
  });
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  electronProcess?.kill();
  renderer.kill();
  process.exit(code);
}
