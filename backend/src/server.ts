import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";

const server = app.listen(env.PORT, () => {
  console.info(`SakhiSetu API listening on http://localhost:${env.PORT} (${env.PAYMENT_MODE.toUpperCase()} payments)`);
});

server.on("error", (error: NodeJS.ErrnoException) => {
  console.error("SakhiSetu API failed to start:", error.message);
  process.exitCode = 1;
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`${signal} received; shutting down SakhiSetu API.`);

  const forceExit = setTimeout(() => {
    console.error("Graceful shutdown timed out; forcing exit.");
    server.closeAllConnections();
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close(async (error) => {
    if (error) console.error("HTTP server close error:", error);
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error("Prisma disconnect error:", disconnectError);
      process.exitCode = 1;
    } finally {
      clearTimeout(forceExit);
    }
  });
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
