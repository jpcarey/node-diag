import { Pack } from "tar-stream";
import { Readable, Writable } from "stream";
import tar from "tar-stream";

type FileInfo = { name: string; size: number; stream: Readable };

export class TarArchive {
  private pack = tar.pack();
  private streamQueue: FileInfo[] = [];
  private size = 0;

  constructor() {}

  addBuffer(name: string, buffer: Buffer) {
    this.size += buffer.length;
    this.pack.entry(
      {
        name: name,
      },
      buffer
    );
    console.log(`Added ${name}`, buffer.length, this.size);
    return this;
  }

  addStream(name: string, size: number, stream: Readable) {
    this.streamQueue.push({
      name,
      size,
      stream,
    });
  }

  write(streamCallback: (pack: Pack) => Writable) {
    return new Promise((resolve, reject) => {
      this.nextEntry(err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }, this.streamQueue.length);
      streamCallback(this.pack).on("error", err => {
        this.pack.destroy(err);
        reject(err);
      });
    });
  }

  private nextEntry(callback: (err?: Error) => void, total: number) {
    const file = this.streamQueue.shift();
    if (file) {
      const writeEntryStream = this.pack.entry(
        {
          name: file.name,
          size: file.size,
        },
        err => {
          if (err) {
            callback(err);
          } else {
            this.size += file.size;
            console.log(
              `Added ${file.name}`,
              file.size,
              this.size,
              `${total - this.streamQueue.length}/${total}`
            );
            this.nextEntry(callback, total);
          }
        }
      );
      file.stream.pipe(writeEntryStream);
    } else {
      this.pack.finalize();
      callback();
    }
  }
}
