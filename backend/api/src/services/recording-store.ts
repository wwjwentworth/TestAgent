import { createReadStream, createWriteStream } from "node:fs";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { RecordingMetadata } from "../domain/recording.js";

const validId = /^[a-zA-Z0-9-]{1,80}$/;

export class RecordingStore {
  constructor(private readonly rootDir: string) { }

  async save(
    id: string,
    stream: Readable,
    input: { title?: string; pageUrl?: string },
  ): Promise<RecordingMetadata> {
    this.assertId(id);
    const directory = join(this.rootDir, id);
    const temporaryPath = join(directory, "video.webm.uploading");
    const videoPath = join(directory, "video.webm");
    await mkdir(directory, { recursive: true });
    try {
      await pipeline(stream, createWriteStream(temporaryPath));
      await rename(temporaryPath, videoPath);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error;
    }
    const videoStat = await stat(videoPath);
    const metadata: RecordingMetadata = {
      id,
      title: input.title,
      pageUrl: input.pageUrl,
      mimeType: "video/webm",
      size: videoStat.size,
      createdAt: new Date().toISOString(),
      videoUrl: `/api/v1/recordings/${id}/video`,
    };
    await writeFile(
      join(directory, "metadata.json"),
      JSON.stringify(metadata, null, 2),
      "utf8",
    );
    return metadata;
  }

  async list(): Promise<RecordingMetadata[]> {
    await mkdir(this.rootDir, { recursive: true });
    const entries = await readdir(this.rootDir, { withFileTypes: true });
    const records = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          try {
            return JSON.parse(
              await readFile(
                join(this.rootDir, entry.name, "metadata.json"),
                "utf8",
              ),
            ) as RecordingMetadata;
          } catch {
            return undefined;
          }
        }),
    );
    return records
      .filter((record): record is RecordingMetadata => Boolean(record))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async openVideo(id: string) {
    this.assertId(id);
    const path = join(this.rootDir, id, "video.webm");
    const fileStat = await stat(path);
    return {
      size: fileStat.size,
      stream: (start?: number, end?: number) =>
        createReadStream(path, { start, end }),
    };
  }

  private assertId(id: string) {
    if (!validId.test(id)) throw new Error("INVALID_RECORDING_ID");
  }
}
