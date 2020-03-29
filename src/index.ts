import dotenv from "dotenv";
import { program } from "commander";
import { TarArchive } from "./tar-writer";
import { TaskRunner, RestCalls } from "./task-runner";
import restCalls from "./elastic-rest.json";

dotenv.config();

program
  .version("0.1.0")
  .option("-C, --chdir <path>", "change the working directory")
  .option("-c, --config <path>", "set config path. defaults to ./deploy.conf")
  .option("-T, --no-tests", "ignore test hook");

program
  .command("setup [env]")
  .description("run setup commands for all envs")
  .option("-s, --setup_mode [mode]", "Which setup mode to use")
  .action((env, options) => {
    const mode = options.setup_mode || "normal";
    env = env || "all";
    console.log(`setup for ${env} env(s) with ${mode} mode`);
  });

program
  .command("exec <cmd>")
  .alias("ex")
  .description("execute the given remote cmd")
  .option("-e, --exec_mode <mode>", "Which exec mode to use")
  .action((cmd, options) => {
    execDiag(restCalls);
    console.log('exec "%s" using %s mode', cmd, options.exec_mode);
  })
  .on("--help", () => {
    console.log("");
    console.log("Examples:");
    console.log("");
    console.log("  $ deploy exec sequential");
    console.log("  $ deploy exec async");
  });

program.parse(process.argv);

function execDiag(restCalls: RestCalls) {
  const { CLOUDURL, USERNAME, PASSWORD } = process.env;
  console.log(CLOUDURL, USERNAME, PASSWORD);
  if (!CLOUDURL || !USERNAME || !PASSWORD) {
    throw new Error("missing CLOUDURL");
  } else if (!USERNAME) {
    throw new Error("missing USERNAME");
  } else if (!PASSWORD) {
    throw new Error("missing PASSWORD");
  }
  const baseUrl = new URL(CLOUDURL);
  const username = USERNAME;
  const password = PASSWORD;

  const tar = new TarArchive();

  const t = new TaskRunner(baseUrl, { username, password }, tar);
  t.startTasks(restCalls);
}
