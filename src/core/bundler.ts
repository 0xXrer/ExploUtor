import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

export enum BundlerTool {
    Wax = 'wax',
    Darklua = 'darklua'
}

export interface BundlerOptions {
    tool: BundlerTool;
    minify?: boolean;
    sourcemap?: boolean;
}

export class BundlerIntegration {
    constructor(
        private readonly outputChannel: vscode.OutputChannel
    ) {}

    /**
     * Bundle Luau code using the configured bundler
     */
    public async bundle(code: string, options: BundlerOptions): Promise<string> {
        this.outputChannel.appendLine(`[Bundler] Bundling with ${options.tool}...`);

        try {
            switch (options.tool) {
                case BundlerTool.Wax:
                    return await this.bundleWithWax(code, options);
                case BundlerTool.Darklua:
                    return await this.bundleWithDarklua(code, options);
                default:
                    throw new Error(`Unknown bundler tool: ${options.tool}`);
            }
        } catch (err) {
            this.outputChannel.appendLine(`[Bundler] Failed: ${err}`);
            throw err;
        }
    }

    /**
     * Check if bundler tool is available
     */
    public async checkAvailability(tool: BundlerTool): Promise<boolean> {
        try {
            const command = tool === BundlerTool.Wax ? 'wax --version' : 'darklua --version';
            await execAsync(command);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Bundle using Wax
     */
    private async bundleWithWax(code: string, options: BundlerOptions): Promise<string> {
        const isAvailable = await this.checkAvailability(BundlerTool.Wax);
        if (!isAvailable) {
            throw new Error('Wax is not installed or not in PATH. Install from: https://github.com/latte-soft/wax');
        }

        // Create temp directory for bundling
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'exploitor-'));
        const inputFile = path.join(tempDir, 'input.luau');
        const outputFile = path.join(tempDir, 'output.luau');

        try {
            // Write input file
            await fs.writeFile(inputFile, code, 'utf-8');

            // Run wax
            const minifyFlag = options.minify ? '--minify' : '';
            const command = `wax bundle ${inputFile} -o ${outputFile} ${minifyFlag}`;

            this.outputChannel.appendLine(`[Bundler] Running: ${command}`);
            const { stdout, stderr } = await execAsync(command);

            if (stdout) {
                this.outputChannel.appendLine(`[Bundler] ${stdout}`);
            }
            if (stderr) {
                this.outputChannel.appendLine(`[Bundler] ${stderr}`);
            }

            // Read bundled output
            const bundled = await fs.readFile(outputFile, 'utf-8');
            this.outputChannel.appendLine('[Bundler] Bundling completed successfully');
            return bundled;

        } finally {
            // Cleanup temp files
            try {
                await fs.rm(tempDir, { recursive: true, force: true });
            } catch {
                // Ignore cleanup errors
            }
        }
    }

    /**
     * Bundle using Darklua
     */
    private async bundleWithDarklua(code: string, options: BundlerOptions): Promise<string> {
        const isAvailable = await this.checkAvailability(BundlerTool.Darklua);
        if (!isAvailable) {
            throw new Error('Darklua is not installed or not in PATH. Install from: https://github.com/seaofvoices/darklua');
        }

        // Create temp directory for bundling
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'exploitor-'));
        const inputFile = path.join(tempDir, 'input.luau');
        const outputFile = path.join(tempDir, 'output.luau');
        const configFile = path.join(tempDir, '.darklua.json');

        try {
            // Write input file
            await fs.writeFile(inputFile, code, 'utf-8');

            // Create darklua config
            const config = {
                generator: "retain-lines",
                rules: [
                    {
                        rule: "bundle",
                        modules_identifier: "__BUNDLER_MODULES__",
                        require_mode: {
                            name: "path"
                        }
                    }
                ]
            };

            if (options.minify) {
                config.rules.push(
                    { rule: "remove_comments" } as any,
                    { rule: "remove_spaces" } as any
                );
            }

            await fs.writeFile(configFile, JSON.stringify(config, null, 2), 'utf-8');

            // Run darklua
            const command = `darklua process --config ${configFile} ${inputFile} ${outputFile}`;

            this.outputChannel.appendLine(`[Bundler] Running: ${command}`);
            const { stdout, stderr } = await execAsync(command);

            if (stdout) {
                this.outputChannel.appendLine(`[Bundler] ${stdout}`);
            }
            if (stderr) {
                this.outputChannel.appendLine(`[Bundler] ${stderr}`);
            }

            // Read bundled output
            const bundled = await fs.readFile(outputFile, 'utf-8');
            this.outputChannel.appendLine('[Bundler] Bundling completed successfully');
            return bundled;

        } finally {
            // Cleanup temp files
            try {
                await fs.rm(tempDir, { recursive: true, force: true });
            } catch {
                // Ignore cleanup errors
            }
        }
    }

    /**
     * Auto-detect and bundle with best available tool
     */
    public async autoBundleIfNeeded(code: string, enabled: boolean, preferredTool: BundlerTool): Promise<string> {
        if (!enabled) {
            return code;
        }

        const isPreferredAvailable = await this.checkAvailability(preferredTool);

        if (isPreferredAvailable) {
            return await this.bundle(code, { tool: preferredTool });
        }

        // Try fallback tool
        const fallbackTool = preferredTool === BundlerTool.Wax ? BundlerTool.Darklua : BundlerTool.Wax;
        const isFallbackAvailable = await this.checkAvailability(fallbackTool);

        if (isFallbackAvailable) {
            this.outputChannel.appendLine(`[Bundler] ${preferredTool} not available, using ${fallbackTool}`);
            return await this.bundle(code, { tool: fallbackTool });
        }

        // No bundler available, return original code
        this.outputChannel.appendLine('[Bundler] No bundler available, executing without bundling');
        return code;
    }
}
