import { spawn, spawnSync } from "node:child_process";
import process from "node:process";

const isWindows = process.platform === "win32";
const npmCmd = isWindows ? "npm.cmd" : "npm";

console.log("[dev:all] Starting backend (port 4000) and frontend (port 8080)...");

const backend = spawn(npmCmd, ["run", "dev:backend"], {
  stdio: "inherit",
  shell: true,
});

const frontend = spawn(npmCmd, ["run", "dev"], {
  stdio: "inherit",
  shell: true,
});

let cleaningUp = false;
function cleanup(exitCode = 0) {
  if (cleaningUp) return;
  cleaningUp = true;

  try {
    if (backend && !backend.killed) {
      if (isWindows && backend.pid) {
        spawnSync("taskkill", ["/pid", backend.pid.toString(), "/T", "/F"], {
          stdio: "ignore",
        });
      } else {
        backend.kill("SIGINT");
      }
    }
  } catch {}

  try {
    if (frontend && !frontend.killed) {
      if (isWindows && frontend.pid) {
        spawnSync("taskkill", ["/pid", frontend.pid.toString(), "/T", "/F"], {
          stdio: "ignore",
        });
      } else {
        frontend.kill("SIGINT");
      }
    }
  } catch {}

  process.exit(exitCode);
}

backend.on("error", (err) => {
  console.error("[dev:all] Backend failed to start:", err);
  cleanup(1);
});

frontend.on("error", (err) => {
  console.error("[dev:all] Frontend failed to start:", err);
  cleanup(1);
});

backend.on("exit", (code) => {
  if (code && code !== 0 && !cleaningUp) {
    console.error(`[dev:all] Backend exited with code ${code}`);
    cleanup(code);
  }
});

frontend.on("exit", (code) => {
  if (code && code !== 0 && !cleaningUp) {
    console.error(`[dev:all] Frontend exited with code ${code}`);
    cleanup(code);
  }
});

process.on("SIGINT", () => cleanup(0));
process.on("SIGTERM", () => cleanup(0));
