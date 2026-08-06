import { google, drive_v3 } from "googleapis";
import { SEED_LIFE_PERIODS, emptySkeleton, type CoverageMap, type Fragment, type LifeSkeleton } from "./types";

const APP_FOLDER_NAME = "Biographer Data";
const FRAGMENTS_FOLDER_NAME = "fragments";
const CHAPTERS_FOLDER_NAME = "chapters";
const COVERAGE_MAP_FILENAME = "coverage-map.json";
const SKELETON_FILENAME = "skeleton.json";

function getDriveClient(accessToken: string): drive_v3.Drive {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: "v3", auth });
}

async function findFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId?: string
): Promise<string | null> {
  const parentClause = parentId ? ` and '${parentId}' in parents` : "";
  const res = await drive.files.list({
    q: `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false${parentClause}`,
    fields: "files(id, name)",
    spaces: "drive",
  });
  return res.data.files?.[0]?.id ?? null;
}

async function createFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId?: string
): Promise<string> {
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    },
    fields: "id",
  });
  if (!res.data.id) throw new Error(`Failed to create Drive folder: ${name}`);
  return res.data.id;
}

async function getOrCreateFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId?: string
): Promise<string> {
  const existing = await findFolder(drive, name, parentId);
  if (existing) return existing;
  return createFolder(drive, name, parentId);
}

export interface AppFolders {
  rootId: string;
  fragmentsId: string;
  chaptersId: string;
}

/** Finds or creates the "Biographer Data" folder structure in the user's Drive. */
export async function ensureAppStructure(accessToken: string): Promise<AppFolders> {
  const drive = getDriveClient(accessToken);
  const rootId = await getOrCreateFolder(drive, APP_FOLDER_NAME);
  const fragmentsId = await getOrCreateFolder(drive, FRAGMENTS_FOLDER_NAME, rootId);
  const chaptersId = await getOrCreateFolder(drive, CHAPTERS_FOLDER_NAME, rootId);
  return { rootId, fragmentsId, chaptersId };
}

async function findFile(
  drive: drive_v3.Drive,
  name: string,
  parentId: string
): Promise<string | null> {
  const res = await drive.files.list({
    q: `name = '${name}' and '${parentId}' in parents and trashed = false`,
    fields: "files(id, name)",
    spaces: "drive",
  });
  return res.data.files?.[0]?.id ?? null;
}

async function writeJsonFile(
  drive: drive_v3.Drive,
  parentId: string,
  filename: string,
  data: unknown
): Promise<void> {
  const body = JSON.stringify(data, null, 2);
  const existingId = await findFile(drive, filename, parentId);
  if (existingId) {
    await drive.files.update({
      fileId: existingId,
      media: { mimeType: "application/json", body },
    });
  } else {
    await drive.files.create({
      requestBody: { name: filename, parents: [parentId] },
      media: { mimeType: "application/json", body },
      fields: "id",
    });
  }
}

async function readJsonFile<T>(
  drive: drive_v3.Drive,
  parentId: string,
  filename: string
): Promise<T | null> {
  const fileId = await findFile(drive, filename, parentId);
  if (!fileId) return null;
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "text" }
  );
  return JSON.parse(res.data as unknown as string) as T;
}

export async function saveFragment(accessToken: string, fragment: Fragment): Promise<void> {
  const drive = getDriveClient(accessToken);
  const { fragmentsId } = await ensureAppStructure(accessToken);
  await writeJsonFile(drive, fragmentsId, `${fragment.id}.json`, fragment);
}

export async function listFragments(accessToken: string): Promise<Fragment[]> {
  const drive = getDriveClient(accessToken);
  const { fragmentsId } = await ensureAppStructure(accessToken);
  const res = await drive.files.list({
    q: `'${fragmentsId}' in parents and trashed = false`,
    fields: "files(id, name)",
    spaces: "drive",
    pageSize: 1000,
  });
  const files = res.data.files ?? [];
  const fragments = await Promise.all(
    files
      .filter((f) => f.name?.endsWith(".json"))
      .map(async (f) => {
        const res = await drive.files.get(
          { fileId: f.id!, alt: "media" },
          { responseType: "text" }
        );
        return JSON.parse(res.data as unknown as string) as Fragment;
      })
  );
  return fragments.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function updateFragment(accessToken: string, fragment: Fragment): Promise<void> {
  await saveFragment(accessToken, fragment);
}

function seedCoverageMap(): CoverageMap {
  return {
    periods: SEED_LIFE_PERIODS,
    cells: [],
    updatedAt: new Date().toISOString(),
  };
}

export async function readCoverageMap(accessToken: string): Promise<CoverageMap> {
  const drive = getDriveClient(accessToken);
  const { rootId } = await ensureAppStructure(accessToken);
  const existing = await readJsonFile<CoverageMap>(drive, rootId, COVERAGE_MAP_FILENAME);
  if (existing) return existing;
  const seeded = seedCoverageMap();
  await writeJsonFile(drive, rootId, COVERAGE_MAP_FILENAME, seeded);
  return seeded;
}

export async function writeCoverageMap(accessToken: string, map: CoverageMap): Promise<void> {
  const drive = getDriveClient(accessToken);
  const { rootId } = await ensureAppStructure(accessToken);
  await writeJsonFile(drive, rootId, COVERAGE_MAP_FILENAME, { ...map, updatedAt: new Date().toISOString() });
}

export async function readSkeleton(accessToken: string): Promise<LifeSkeleton> {
  const drive = getDriveClient(accessToken);
  const { rootId } = await ensureAppStructure(accessToken);
  const existing = await readJsonFile<LifeSkeleton>(drive, rootId, SKELETON_FILENAME);
  if (existing) return existing;
  const seeded = emptySkeleton();
  await writeJsonFile(drive, rootId, SKELETON_FILENAME, seeded);
  return seeded;
}

export async function writeSkeleton(accessToken: string, skeleton: LifeSkeleton): Promise<void> {
  const drive = getDriveClient(accessToken);
  const { rootId } = await ensureAppStructure(accessToken);
  await writeJsonFile(drive, rootId, SKELETON_FILENAME, skeleton);
}

export async function listChapterFiles(accessToken: string): Promise<{ id: string; name: string }[]> {
  const drive = getDriveClient(accessToken);
  const { chaptersId } = await ensureAppStructure(accessToken);
  const res = await drive.files.list({
    q: `'${chaptersId}' in parents and trashed = false`,
    fields: "files(id, name)",
    spaces: "drive",
  });
  return (res.data.files ?? []).map((f) => ({ id: f.id!, name: f.name! }));
}
