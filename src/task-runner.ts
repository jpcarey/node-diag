import axios from "axios";
import semver from "semver";
import fs from "fs";
import path from "path";

interface RestCalls {
  [key: string]: {
    versions: { [key: string]: string };
    extension?: string;
    subdir?: string;
    retry?: boolean;
    showErrors?: boolean;
  };
}

interface Auth {
  username: string;
  password: string;
}

export async function taskRunner(restCalls: RestCalls) {
  const { CLOUDURL, USERNAME, PASSWORD } = process.env;
  console.log(CLOUDURL, USERNAME, PASSWORD);
  if (!CLOUDURL || !USERNAME || !PASSWORD) {
    throw new Error("missing CLOUDURL");
  } else if (!USERNAME) {
    throw new Error("missing USERNAME");
  } else if (!PASSWORD) {
    throw new Error("missing PASSWORD");
  }
  const baseUrl = CLOUDURL;
  const username = USERNAME;
  const password = PASSWORD;

  const baseFilePath = "tmp/";

  const esVersion = await clusterVersion(new URL(baseUrl), {
    username,
    password,
  });

  Object.entries(restCalls)
    // .slice(0, 1)
    .forEach(async ([name, task]) => {
      try {
        for (let [rule, uri] of Object.entries(task.versions)) {
          if (semver.satisfies(esVersion, rule)) {
            const url = new URL(uri, baseUrl);
            const resp = await doRequest(url, { username, password });

            if (task.subdir) {
              fs.mkdir(
                path.join(baseFilePath, task.subdir),
                { recursive: true },
                err => {
                  if (err) throw err;
                }
              );
            }

            const filepath = path.join(
              baseFilePath,
              task.subdir ?? "",
              `${name}${task.extension ?? ".json"}`
            );

            const data =
              typeof resp.data === "string"
                ? resp.data
                : JSON.stringify(resp.data, undefined, 2);

            fs.writeFile(filepath, data, err => {
              if (err) throw err;
              console.log(`created: ${filepath}`);
            });
          } else {
            console.log(
              `Skipping: ${uri}, ${rule} does not match [${esVersion}]`
            );
          }
        }
      } catch (err) {
        console.error(err.message);
      }
    });
}

async function doRequest(url: URL, auth: Auth) {
  return axios.get(url.href, { auth });
}

async function clusterVersion(url: URL, auth: Auth) {
  const resp = await doRequest(url, auth);
  return resp.data.version.number;
}
