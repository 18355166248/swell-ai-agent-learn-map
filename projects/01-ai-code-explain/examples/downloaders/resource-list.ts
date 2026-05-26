import fs from "node:fs";
import path from "node:path";
import type { DownloadResourceInput } from "../tasks.js";

export interface DownloadResourceResult {
  resourceUrl: string;
  fileName: string;
  localPath: string;
  skipped: boolean;
}

function inferFileName(resource: DownloadResourceInput, index: number): string {
  if (resource.fileName) {
    return resource.fileName;
  }

  if (resource.url.startsWith("data:")) {
    return `resource-${index + 1}.bin`;
  }

  const url = new URL(resource.url);
  const baseName = path.basename(url.pathname);
  return baseName || `resource-${index + 1}.bin`;
}

export async function downloadResourceListItem(
  resource: DownloadResourceInput,
  downloadDir: string,
  index: number
): Promise<DownloadResourceResult> {
  fs.mkdirSync(downloadDir, { recursive: true });

  const fileName = inferFileName(resource, index);
  const localPath = path.join(downloadDir, fileName);

  if (fs.existsSync(localPath)) {
    return {
      resourceUrl: resource.url,
      fileName,
      localPath,
      skipped: true,
    };
  }

  const response = await fetch(resource.url);

  if (!response.ok) {
    throw new Error(`Failed to download resource: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(localPath, Buffer.from(arrayBuffer));

  return {
    resourceUrl: resource.url,
    fileName,
    localPath,
    skipped: false,
  };
}
