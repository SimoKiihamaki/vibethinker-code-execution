import fs from 'fs/promises';
import path from 'path';
import winston from 'winston';
import chalk from 'chalk';

export const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const INDEX_FILES = SOURCE_EXTENSIONS.map(ext => `index${ext}`);
const repoRoot = path.resolve(process.cwd());
let repoRealPathPromise: Promise<string> | null = null;

export const getRepositoryRealPath = async (): Promise<string> => {
    if (!repoRealPathPromise) {
        repoRealPathPromise = fs.realpath(repoRoot).catch(() => repoRoot);
    }
    return repoRealPathPromise;
};

export const isPathWithinRepo = (candidateReal: string, repoReal: string): boolean => {
    if (candidateReal === repoReal) return true;
    const prefix = repoReal.endsWith(path.sep) ? repoReal : `${repoReal}${path.sep}`;
    return candidateReal.startsWith(prefix);
};

export async function validatePath(p: string): Promise<string> {
    const repoRealPath = await getRepositoryRealPath();
    const resolved = path.resolve(p);
    const targetRealPath = await fs.realpath(resolved).catch(() => resolved);

    if (!isPathWithinRepo(targetRealPath, repoRealPath)) {
        throw new Error(`Access denied: Path ${p} is outside repository root`);
    }

    return targetRealPath;
}

export function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function resolveImportPath(fromFile: string, specifier: string): Promise<string | null> {
    // Input validation
    if (!fromFile || typeof fromFile !== 'string') {
        throw new Error('Invalid fromFile: must be a non-empty string');
    }
    if (!specifier || typeof specifier !== 'string') {
        throw new Error('Invalid specifier: must be a non-empty string');
    }

    const repoRealPath = await getRepositoryRealPath();
    const basePath = path.resolve(path.dirname(fromFile), specifier);
    const candidates = [basePath, ...SOURCE_EXTENSIONS.map(ext => `${basePath}${ext}`)];

    const resolveIndex = async (directory: string): Promise<string | null> => {
        const indexCandidates = INDEX_FILES.map(index => path.join(directory, index));
        const checks = await Promise.all(indexCandidates.map(async candidate => {
            try {
                const stats = await fs.stat(candidate);
                if (!stats.isFile()) return null;
                const realCandidate = await fs.realpath(candidate).catch(() => null);
                return realCandidate && isPathWithinRepo(realCandidate, repoRealPath) ? candidate : null;
            } catch {
                return null;
            }
        }));
        return checks.find(Boolean) ?? null;
    };

    const checks = await Promise.all(candidates.map(async candidate => {
        try {
            const stats = await fs.stat(candidate);
            if (stats.isFile()) {
                const realCandidate = await fs.realpath(candidate).catch(() => null);
                if (realCandidate && isPathWithinRepo(realCandidate, repoRealPath)) {
                    return candidate;
                }
                return null;
            }
            if (stats.isDirectory()) {
                const realDir = await fs.realpath(candidate).catch(() => null);
                if (!realDir || !isPathWithinRepo(realDir, repoRealPath)) {
                    return null;
                }
                return await resolveIndex(candidate);
            }
            return null;
        } catch {
            return null;
        }
    }));

    return checks.find(Boolean) ?? null;
}

export const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${chalk.gray(timestamp)} ${level} ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console({
            stderrLevels: ['error', 'warn', 'info', 'debug', 'verbose', 'silly'],
        }),
    ],
});
