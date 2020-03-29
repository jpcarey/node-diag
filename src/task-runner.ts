import axios, { AxiosInstance } from "axios";
import semver from "semver";
import fs from "fs";
import path from "path";
// import { TarArchive } from "./tar-writer";
import zlib from "zlib";
import { Writable } from "stream";
import { Pack } from "tar-stream";

export interface RestCalls {
  [key: string]: RestCallItem;
}

interface RestCallItem {
  versions: { [key: string]: string };
  extension?: string;
  subdir?: string;
  retry?: boolean;
  showErrors?: boolean;
}

interface TaskDetail extends RestCallItem {
  name: string;
  uri: string;
}

interface Auth {
  username: string;
  password: string;
}

interface DiagOutput {
  write: (streamCallback: (pack: Pack) => Writable) => Promise<unknown>;
  addBuffer: (name: string, buffer: Buffer) => any;
}

export class TaskRunner {
  private instance: AxiosInstance;
  private diagDate = new Date()
    .toISOString()
    .substr(0, 19)
    .replace(/[-:]/g, "")
    .replace("T", "-");
  private baseFilePath = `diag-${this.diagDate}`;
  private outputFile = `${this.baseFilePath}.tar.gz`;
  private yourTarball = fs.createWriteStream(this.outputFile);
  readonly baseUrl: URL;
  private output: DiagOutput;

  constructor(url: URL, auth: Auth, output: DiagOutput) {
    this.baseUrl = url;
    this.instance = this.setupAuth(url, auth);
    this.output = output;
  }

  private setupAuth(url: URL, auth: Auth) {
    return axios.create({
      baseURL: url.href,
      timeout: 5000,
      auth,
      // headers: {'X-Custom-Header': 'foobar'}
    });
  }

  async startTasks(restCalls: RestCalls) {
    const esVersion = await this.clusterVersion();
    const tasks = [];

    for (const [name, task] of Object.entries(restCalls)) {
      for (const [rule, uri] of Object.entries(task.versions)) {
        if (semver.satisfies(esVersion, rule)) {
          tasks.push(
            this.runTask({
              ...task,
              name,
              uri,
            })
          );
        } else {
          console.log(
            `Skipping: ${uri}, ${rule} does not match [${esVersion}]`
          );
        }
      }
    }

    await Promise.all(tasks);

    await this.output.write(stream =>
      stream
        .pipe(zlib.createGzip({ level: zlib.constants.Z_BEST_COMPRESSION }))
        .pipe(this.yourTarball)
    );

    this.yourTarball.on("close", () => {
      console.log(`${this.outputFile} has been written`);
      fs.stat(this.outputFile, (err, stats) => {
        if (err) throw err;
        console.log(stats);
        console.log("Got file info successfully!");
      });
    });
  }

  private async runTask(task: TaskDetail) {
    try {
      const filepath = path.join(
        this.baseFilePath,
        task.subdir ?? "",
        `${task.name}${task.extension ?? ".json"}`
      );

      const resp = await this.doRequest(task.uri);

      this.output.addBuffer(filepath, resp.data);
    } catch (err) {
      console.error(err.message);
    }
  }

  private async doRequest(uri: string) {
    return this.instance({
      method: "GET",
      url: uri,
      responseType: "arraybuffer",
    });
  }

  private async clusterVersion() {
    const resp = await this.instance.get(this.baseUrl.href);
    return resp.data.version.number;
  }
}
