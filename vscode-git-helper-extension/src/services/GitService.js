const vscode = require('vscode');
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execAsync = promisify(exec);

class GitService {
    constructor() {
        this.currentSubdir = ''; // Relative path within workspace
    }

    getWorkspacePath() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            return workspaceFolders[0].uri.fsPath;
        }
        return undefined;
    }

    getCurrentPath() {
        const workspacePath = this.getWorkspacePath();
        if (!workspacePath) {
            return undefined;
        }
        return path.join(workspacePath, this.currentSubdir);
    }

    async getWorkspaceInfo() {
        const workspacePath = this.getWorkspacePath();
        
        if (!workspacePath) {
            return 'No workspace folder open.';
        }

        let info = `Workspace: ${workspacePath}\n`;

        try {
            // Check if it's a git repo
            const { stdout: gitRoot } = await execAsync('git rev-parse --git-dir', { cwd: workspacePath });
            if (gitRoot) {
                info += 'Git repository: Yes\n';

                // Get current branch
                try {
                    const { stdout: branch } = await execAsync('git branch --show-current', { cwd: workspacePath });
                    info += `Current branch: ${branch.trim()}\n`;
                } catch {
                    info += 'Current branch: Unable to determine\n';
                }

                // Get status summary
                try {
                    const { stdout: status } = await execAsync('git status --porcelain', { cwd: workspacePath });
                    const lines = status.trim().split('\n').filter(l => l);
                    if (lines.length === 0) {
                        info += 'Working tree: Clean\n';
                    } else {
                        const modified = lines.filter(l => l.startsWith(' M') || l.startsWith('M ')).length;
                        const added = lines.filter(l => l.startsWith('A ') || l.startsWith('??')).length;
                        const deleted = lines.filter(l => l.startsWith(' D') || l.startsWith('D ')).length;
                        info += `Changes: ${modified} modified, ${added} added/untracked, ${deleted} deleted\n`;
                    }
                } catch {
                    info += 'Status: Unable to determine\n';
                }

                // Get recent commits
                try {
                    const { stdout: log } = await execAsync('git log --oneline -3', { cwd: workspacePath });
                    info += `Recent commits:\n${log}`;
                } catch {
                    info += 'Recent commits: None or unable to retrieve\n';
                }
            }
        } catch {
            info += 'Git repository: No (or git not initialized)\n';
        }

        return info;
    }

    async executeCommand(command) {
        const workspacePath = this.getWorkspacePath();
        
        if (!workspacePath) {
            throw new Error('No workspace folder open. Please open a folder first.');
        }

        // Security check - only allow git commands
        const trimmedCommand = command.trim();
        if (!trimmedCommand.startsWith('git ')) {
            throw new Error('Only git commands are allowed for security reasons.');
        }

        // Block dangerous commands that could cause data loss without confirmation
        const dangerousPatterns = [
            /git\s+push\s+.*--force/i,
            /git\s+push\s+-f/i,
            /git\s+reset\s+--hard/i,
            /git\s+clean\s+-fd/i,
            /git\s+branch\s+-D/i
        ];

        for (const pattern of dangerousPatterns) {
            if (pattern.test(trimmedCommand)) {
                const confirm = await vscode.window.showWarningMessage(
                    `⚠️ This is a destructive command: "${trimmedCommand}". Are you sure?`,
                    { modal: true },
                    'Yes, execute',
                    'Cancel'
                );
                if (confirm !== 'Yes, execute') {
                    throw new Error('Command cancelled by user.');
                }
                break;
            }
        }

        try {
            const { stdout, stderr } = await execAsync(trimmedCommand, { 
                cwd: workspacePath,
                timeout: 30000
            });
            
            // Git often outputs to stderr even for successful operations
            return stdout || stderr || 'Command completed successfully.';
        } catch (error) {
            if (error && typeof error === 'object' && 'stderr' in error) {
                throw new Error(error.stderr);
            }
            throw error;
        }
    }

    async getStagedDiff() {
        const workspacePath = this.getWorkspacePath();
        if (!workspacePath) {
            return '';
        }

        try {
            const { stdout } = await execAsync('git diff --staged --stat', { cwd: workspacePath });
            return stdout;
        } catch {
            return '';
        }
    }

    async getUnstagedDiff() {
        const workspacePath = this.getWorkspacePath();
        if (!workspacePath) {
            return '';
        }

        try {
            const { stdout } = await execAsync('git diff --stat', { cwd: workspacePath });
            return stdout;
        } catch {
            return '';
        }
    }

    /**
     * Execute safe shell commands for exploring and creating files in the repository
     * Allows read commands + echo/touch for file creation
     */
    async executeShellCommand(command) {
        const workspacePath = this.getWorkspacePath();
        
        if (!workspacePath) {
            throw new Error('No workspace folder open.');
        }

        const trimmedCommand = command.trim();
        
        // Parse the command
        const parts = trimmedCommand.split(/\s+/);
        const cmd = parts[0];
        
        // Allowed commands: read-only + file creation
        const allowedCommands = ['ls', 'cat', 'head', 'tail', 'find', 'tree', 'wc', 'pwd', 'cd', 'file', 'echo', 'touch', 'mkdir'];
        
        if (!allowedCommands.includes(cmd)) {
            throw new Error(`Command "${cmd}" is not allowed. Allowed commands: ${allowedCommands.join(', ')}`);
        }

        // Handle cd specially
        if (cmd === 'cd') {
            return this.handleCd(parts.slice(1).join(' '), workspacePath);
        }

        // Handle pwd
        if (cmd === 'pwd') {
            const currentPath = this.getCurrentPath();
            return currentPath || workspacePath;
        }

        // Security: Check that no path arguments try to escape the workspace
        const currentPath = this.getCurrentPath() || workspacePath;
        
        // For commands with file arguments, validate paths
        for (let i = 1; i < parts.length; i++) {
            const arg = parts[i];
            // Skip flags
            if (arg.startsWith('-')) {
                continue;
            }
            
            // Resolve the full path and check it's within workspace
            const resolvedPath = path.resolve(currentPath, arg);
            if (!resolvedPath.startsWith(workspacePath)) {
                throw new Error(`Access denied: Cannot access paths outside the workspace.`);
            }
        }

        try {
            const { stdout, stderr } = await execAsync(trimmedCommand, { 
                cwd: currentPath,
                timeout: 10000,
                maxBuffer: 1024 * 1024 // 1MB max output
            });
            
            return stdout || stderr || 'Command completed (no output).';
        } catch (error) {
            if (error && typeof error === 'object' && 'stderr' in error) {
                throw new Error(error.stderr);
            }
            throw error;
        }
    }

    handleCd(targetDir, workspacePath) {
        if (!targetDir || targetDir === '~' || targetDir === '/') {
            // cd to workspace root
            this.currentSubdir = '';
            return `Changed to workspace root: ${workspacePath}`;
        }

        if (targetDir === '..') {
            // Go up one directory (but not above workspace)
            if (this.currentSubdir) {
                this.currentSubdir = path.dirname(this.currentSubdir);
                if (this.currentSubdir === '.') {
                    this.currentSubdir = '';
                }
            }
            return `Changed to: ${this.getCurrentPath()}`;
        }

        // Resolve the new path
        const currentPath = this.getCurrentPath() || workspacePath;
        const newPath = path.resolve(currentPath, targetDir);
        
        // Security check: must be within workspace
        if (!newPath.startsWith(workspacePath)) {
            throw new Error('Cannot navigate outside the workspace.');
        }

        // Update current subdirectory (relative to workspace)
        this.currentSubdir = path.relative(workspacePath, newPath);
        
        return `Changed to: ${newPath}`;
    }

    getCurrentDirectory() {
        return this.getCurrentPath() || this.getWorkspacePath() || 'No workspace open';
    }
}

module.exports = { GitService };
