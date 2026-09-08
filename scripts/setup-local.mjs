import { randomBytes } from "node:crypto"
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const localStateDirectory = join(projectRoot, ".local")
const localSecretPath = join(localStateDirectory, "auth-secret")
const localDatabasePath = join(projectRoot, "prisma", "dev.local.db")
const localDatabaseUrl = "file:./dev.local.db"
const prismaCliPath = join(projectRoot, "node_modules", "prisma", "build", "index.js")
const nextCliPath = join(projectRoot, "node_modules", "next", "dist", "bin", "next")
const migrationReadinessPath = join(projectRoot, "scripts", "check-local-migration-readiness.mjs")
const argumentsSet = new Set(process.argv.slice(2))
const supportedArguments = new Set(["--dev", "--help", "--reset", "--seed", "--studio"])
const privateDirectoryMode = 0o700
const privateFileMode = 0o600

// Child processes (Prisma, the seed, and Next.js) inherit this secure default.
process.umask(0o077)

const nodeMajorVersion = Number.parseInt(process.versions.node.split(".")[0], 10)
if (nodeMajorVersion !== 24) {
  console.error(
    `Local setup requires Node.js 24.x; this process is running ${process.version}. ` +
      "Activate the version in .node-version or .nvmrc, then retry.",
  )
  process.exit(1)
}

for (const argument of argumentsSet) {
  if (!supportedArguments.has(argument)) {
    console.error(`Unknown local setup option: ${argument}`)
    process.exit(1)
  }
}

if (argumentsSet.has("--help")) {
  console.log(`Usage: node scripts/setup-local.mjs [options]

Options:
  --dev     Seed the demo data when requested, then start Next.js development mode
  --reset   Delete only prisma/dev.local.db and its SQLite sidecar files
  --seed    Upsert the deterministic demo account, Skill Leaf, folder, and note
  --studio  Open Prisma Studio after applying migrations

Environment:
  REHEARSE_PRISMA_RUST_LOG  Override the local Prisma engine log level (default: info)`)
  process.exit(0)
}

if (process.env.NODE_ENV === "production") {
  console.error("Local database setup is disabled when NODE_ENV=production.")
  process.exit(1)
}

if (argumentsSet.has("--dev") && argumentsSet.has("--studio")) {
  console.error("Choose either --dev or --studio; both commands are long-running.")
  process.exit(1)
}

function ensurePrivateDirectory(directoryPath) {
  mkdirSync(directoryPath, { recursive: true, mode: privateDirectoryMode })
  const stats = lstatSync(directoryPath)

  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error(`Refusing to use a non-directory private path: ${directoryPath}`)
  }

  chmodSync(directoryPath, privateDirectoryMode)
}

function ensurePrivateFile(filePath) {
  const stats = lstatSync(filePath)

  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new Error(`Refusing to use a non-file private path: ${filePath}`)
  }

  chmodSync(filePath, privateFileMode)
}

function repairPrivateTree(directoryPath) {
  ensurePrivateDirectory(directoryPath)

  for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
    const entryPath = join(directoryPath, entry.name)

    if (entry.isSymbolicLink()) {
      throw new Error(`Refusing to follow a symbolic link in private storage: ${entryPath}`)
    }

    if (entry.isDirectory()) {
      repairPrivateTree(entryPath)
    } else if (entry.isFile()) {
      ensurePrivateFile(entryPath)
    } else {
      throw new Error(`Unsupported entry in private storage: ${entryPath}`)
    }
  }
}

function repairDatabasePermissions() {
  for (const suffix of ["", "-journal", "-shm", "-wal"]) {
    const databaseFilePath = `${localDatabasePath}${suffix}`
    if (existsSync(databaseFilePath)) {
      ensurePrivateFile(databaseFilePath)
    }
  }
}

repairPrivateTree(localStateDirectory)
repairPrivateTree(join(projectRoot, "uploads"))

if (argumentsSet.has("--reset")) {
  for (const suffix of ["", "-journal", "-shm", "-wal"]) {
    rmSync(`${localDatabasePath}${suffix}`, { force: true })
  }
  console.log("Removed only the isolated local database at prisma/dev.local.db")
}

if (!existsSync(localSecretPath)) {
  writeFileSync(localSecretPath, randomBytes(32).toString("base64url"), {
    encoding: "utf8",
    flag: "wx",
    mode: privateFileMode,
  })
}
ensurePrivateFile(localSecretPath)
repairDatabasePermissions()

const localEnvironment = {
  ...process.env,
  DATABASE_URL: localDatabaseUrl,
  AUTH_SECRET: readFileSync(localSecretPath, "utf8").trim(),
  AUTH_URL: process.env.AUTH_URL ?? "http://localhost:3000",
  REHEARSE_LOCAL_GENERATOR: process.env.REHEARSE_LOCAL_GENERATOR ?? "1",
  RUST_LOG: process.env.REHEARSE_PRISMA_RUST_LOG ?? "info",
}

function run(command, args = []) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: localEnvironment,
    stdio: "inherit",
  })

  if (result.error) {
    console.error(result.error.message)
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

run(process.execPath, [prismaCliPath, "generate"])
run(process.execPath, [migrationReadinessPath])
run(process.execPath, [prismaCliPath, "migrate", "deploy"])
repairDatabasePermissions()

if (argumentsSet.has("--seed")) {
  run(process.execPath, [join(projectRoot, "scripts", "seed-local.mjs")])
  repairDatabasePermissions()
}

if (argumentsSet.has("--studio")) {
  run(process.execPath, [prismaCliPath, "studio"])
}

if (argumentsSet.has("--dev")) {
  run(process.execPath, [nextCliPath, "dev"])
} else {
  console.log("Local database is ready at prisma/dev.local.db")
}
