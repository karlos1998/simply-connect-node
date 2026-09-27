import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = await mkdtemp(join(tmpdir(), "simply-connect-pack-"));
try {
  const archives = [];
  for (const workspace of ["@simply-connect/node", "@simply-connect/nestjs"]) {
    const output = execFileSync(
      "npm",
      [
        "pack",
        "--workspace",
        workspace,
        "--json",
        "--pack-destination",
        directory,
      ],
      { encoding: "utf8" },
    );
    const [{ filename, files }] = JSON.parse(output);
    archives.push(join(directory, filename));
    const paths = new Set(files.map((file) => file.path));
    for (const required of [
      "dist/index.js",
      "dist/index.cjs",
      "dist/index.d.ts",
      "package.json",
    ]) {
      if (!paths.has(required))
        throw new Error(`${filename} is missing ${required}`);
    }
  }

  const corePackage = JSON.parse(
    await readFile(join(process.cwd(), "packages/node/package.json"), "utf8"),
  );
  if (corePackage.exports?.["."]?.import !== "./dist/index.js")
    throw new Error("ESM export is invalid");
  if (corePackage.exports?.["."]?.require !== "./dist/index.cjs")
    throw new Error("CommonJS export is invalid");

  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      "import('./packages/node/dist/index.js').then(m => { if (!m.SimplyConnectClient) process.exit(1) })",
    ],
    { stdio: "inherit" },
  );
  execFileSync(
    process.execPath,
    [
      "--eval",
      "const m = require('./packages/node/dist/index.cjs'); if (!m.SimplyConnectClient) process.exit(1)",
    ],
    { stdio: "inherit" },
  );

  const consumer = join(directory, "consumer");
  await mkdir(consumer);
  await writeFile(
    join(consumer, "package.json"),
    JSON.stringify({ name: "package-consumer", private: true, type: "module" }),
  );
  execFileSync(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--package-lock=false",
      "--no-audit",
      "--no-fund",
      ...archives,
      "@nestjs/common@12",
      "@nestjs/core@12",
      "reflect-metadata",
      "rxjs",
    ],
    { cwd: consumer, stdio: "inherit" },
  );
  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      "const core = await import('@simply-connect/node'); const nest = await import('@simply-connect/nestjs'); if (!core.SimplyConnectClient || !nest.SimplyConnectModule || !nest.SimplyConnectPanelModule) process.exit(1)",
    ],
    { cwd: consumer, stdio: "inherit" },
  );
  execFileSync(
    process.execPath,
    [
      "--eval",
      "const core = require('@simply-connect/node'); const nest = require('@simply-connect/nestjs'); if (!core.SimplyConnectClient || !nest.SimplyConnectModule || !nest.SimplyConnectPanelModule) process.exit(1)",
    ],
    { cwd: consumer, stdio: "inherit" },
  );
  console.log("Packed ESM and CommonJS artifacts install in a clean project.");
} finally {
  await rm(directory, { recursive: true, force: true });
}
