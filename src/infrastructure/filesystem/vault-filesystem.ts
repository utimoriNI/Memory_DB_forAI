import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, copyFile, mkdir, open, readFile, realpath, rename, stat } from "node:fs/promises";
import path from "node:path";

export class VaultPathError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "VaultPathError";
  }
}

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export class VaultFileSystem {
  readonly #root: string;
  #canonicalRoot: string | undefined;

  public constructor(root: string) {
    this.#root = path.resolve(root);
  }

  public get root(): string {
    return this.#root;
  }

  public async initialize(): Promise<void> {
    await mkdir(this.#root, { recursive: true });
    this.#canonicalRoot = await realpath(this.#root);
  }

  public normalizeRelativePath(relativePath: string): string {
    if (!relativePath || relativePath.includes("\0") || path.isAbsolute(relativePath)) {
      throw new VaultPathError("Path must be a non-empty Vault-relative path");
    }
    const normalized = path.posix.normalize(relativePath.replaceAll("\\", "/"));
    if (normalized === ".." || normalized.startsWith("../") || normalized === ".") {
      throw new VaultPathError("Path traversal is not allowed");
    }
    return normalized;
  }

  public async resolveForRead(relativePath: string): Promise<string> {
    const candidate = this.#lexicalPath(relativePath);
    const canonicalRoot = await this.#getCanonicalRoot();
    let canonical: string;
    try {
      canonical = await realpath(candidate);
    } catch {
      throw new VaultPathError(`Vault path does not exist: ${relativePath}`);
    }
    if (!isWithin(canonicalRoot, canonical)) {
      throw new VaultPathError("Resolved path escapes the Vault root");
    }
    return canonical;
  }

  public async resolveForWrite(relativePath: string): Promise<string> {
    const candidate = this.#lexicalPath(relativePath);
    const canonicalRoot = await this.#getCanonicalRoot();
    let existing = path.dirname(candidate);
    while (true) {
      try {
        const canonicalParent = await realpath(existing);
        if (!isWithin(canonicalRoot, canonicalParent)) {
          throw new VaultPathError("Resolved parent escapes the Vault root");
        }
        break;
      } catch (error) {
        if (error instanceof VaultPathError) throw error;
        const parent = path.dirname(existing);
        if (parent === existing) throw new VaultPathError("Unable to resolve a safe Vault parent");
        existing = parent;
      }
    }
    try {
      const canonicalTarget = await realpath(candidate);
      if (!isWithin(canonicalRoot, canonicalTarget)) {
        throw new VaultPathError("Resolved target escapes the Vault root");
      }
    } catch (error) {
      if (error instanceof VaultPathError) throw error;
    }
    return candidate;
  }

  public async exists(relativePath: string): Promise<boolean> {
    try {
      await access(await this.resolveForRead(relativePath), constants.F_OK);
      return true;
    } catch (error) {
      if (error instanceof VaultPathError && error.message.includes("escapes")) throw error;
      return false;
    }
  }

  public async readText(relativePath: string): Promise<string> {
    return readFile(await this.resolveForRead(relativePath), "utf8");
  }

  public async writeTextAtomic(
    relativePath: string,
    content: string,
    options: { createOnly?: boolean; backup?: boolean } = {}
  ): Promise<{ backupPath?: string }> {
    const normalized = this.normalizeRelativePath(relativePath);
    const target = await this.resolveForWrite(normalized);
    await mkdir(path.dirname(target), { recursive: true });
    const targetExists = await this.exists(normalized);
    if (options.createOnly && targetExists) {
      throw new Error(`Refusing to overwrite existing Vault file: ${normalized}`);
    }
    const backupPath =
      targetExists && options.backup ? await this.#backup(normalized, target) : undefined;
    const temporary = `${target}.tmp-${randomUUID()}`;
    const handle = await open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(content, { encoding: "utf8" });
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await rename(temporary, target);
    } catch (error) {
      await import("node:fs/promises").then(({ rm }) => rm(temporary, { force: true }));
      throw error;
    }
    return backupPath ? { backupPath } : {};
  }

  public async move(sourcePath: string, destinationPath: string): Promise<void> {
    const source = await this.resolveForRead(sourcePath);
    const destination = await this.resolveForWrite(destinationPath);
    if (await this.exists(destinationPath))
      throw new Error(`Destination already exists: ${destinationPath}`);
    await mkdir(path.dirname(destination), { recursive: true });
    await rename(source, destination);
  }

  public async fileStat(relativePath: string): Promise<{ mtimeMs: number }> {
    const result = await stat(await this.resolveForRead(relativePath));
    return { mtimeMs: result.mtimeMs };
  }

  #lexicalPath(relativePath: string): string {
    const normalized = this.normalizeRelativePath(relativePath);
    const candidate = path.resolve(this.#root, normalized);
    if (!isWithin(this.#root, candidate)) throw new VaultPathError("Path escapes the Vault root");
    return candidate;
  }

  async #getCanonicalRoot(): Promise<string> {
    if (!this.#canonicalRoot) await this.initialize();
    return this.#canonicalRoot as string;
  }

  async #backup(relativePath: string, target: string): Promise<string> {
    const stamp = new Date().toISOString().replaceAll(":", "-");
    const backupRelative = path.posix.join("_state/backups", `${relativePath}.${stamp}.bak`);
    const backupTarget = await this.resolveForWrite(backupRelative);
    await mkdir(path.dirname(backupTarget), { recursive: true });
    await copyFile(target, backupTarget, constants.COPYFILE_EXCL);
    return backupRelative;
  }
}
