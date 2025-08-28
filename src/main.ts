import { PORT } from "./configs";
import HttpServer from "./http-server";
import { logger } from "./lib";

enum ExitStatus {
  Failure = 1,
  Success = 0,
}

async function main() {
  try {
    const httpServer = new HttpServer();
    const exitSignals: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGQUIT"];

    exitSignals.map((sig) =>
      process.on(sig, async () => {
        try {
          httpServer.stop();
          logger.info("Existing app with success");
          process.exit(ExitStatus.Success);
        } catch (error) {
          logger.error(`App exited with error: ${error}`);
          process.exit(ExitStatus.Failure);
        }
      })
    );

    const app = await httpServer.createApp();

    app.listen(PORT, "0.0.0.0", () => {
      logger.info(`server listening on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    logger.error(`App exited with error: ${error}`);
    process.exit(ExitStatus.Failure);
  }
}

main();
