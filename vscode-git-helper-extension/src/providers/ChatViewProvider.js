const vscode = require('vscode');
const { GitService } = require('../services/GitService');
const { LLMService } = require('../services/LLMService');
const { getWebviewContent } = require('../webview/chatWebview');

class ChatViewProvider {
    static viewType = 'git-helper-chat';

    constructor(extensionUri, gitService) {
        this._extensionUri = extensionUri;
        this.gitService = gitService;
        this.llmService = new LLMService();
        this._view = undefined;
    }

    resolveWebviewView(webviewView, _context, _token) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = getWebviewContent(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'sendMessage':
                    if (data.message) {
                        await this.handleUserMessage(data.message);
                    }
                    break;
                case 'executeCommand':
                    if (data.command) {
                        await this.executeGitCommand(data.command);
                    }
                    break;
                case 'clearHistory':
                    this.llmService.clearHistory();
                    break;
            }
        });
    }

    async handleUserMessage(message) {
        if (!this._view) {
            return;
        }

        // Show user message in chat
        this._view.webview.postMessage({
            type: 'addMessage',
            role: 'user',
            content: message
        });

        // Show loading indicator
        this._view.webview.postMessage({
            type: 'setLoading',
            loading: true
        });

        try {
            // Get workspace info for context (including current directory)
            const workspaceInfo = await this.gitService.getWorkspaceInfo();
            const currentDir = this.gitService.getCurrentDirectory();
            const fullContext = `${workspaceInfo}\nCurrent directory: ${currentDir}`;
            
            // Get response from LLM
            const response = await this.llmService.sendMessage(message, fullContext);
            
            // Check if response contains a git command to execute
            const gitCommandMatch = response.match(/\[EXECUTE_GIT\](.*?)\[\/EXECUTE_GIT\]/s);
            // Check if response contains a shell command to execute
            const shellCommandMatch = response.match(/\[EXECUTE_SHELL\](.*?)\[\/EXECUTE_SHELL\]/s);
            
            if (gitCommandMatch) {
                const command = gitCommandMatch[1].trim();
                const cleanResponse = response.replace(/\[EXECUTE_GIT\].*?\[\/EXECUTE_GIT\]/s, '').trim();
                
                // Send response without command tags
                this._view.webview.postMessage({
                    type: 'addMessage',
                    role: 'assistant',
                    content: cleanResponse,
                    suggestedCommand: command,
                    commandType: 'git'
                });
            } else if (shellCommandMatch) {
                const command = shellCommandMatch[1].trim();
                const cleanResponse = response.replace(/\[EXECUTE_SHELL\].*?\[\/EXECUTE_SHELL\]/s, '').trim();
                
                // Auto-execute shell commands (they're read-only and safe)
                this._view.webview.postMessage({
                    type: 'addMessage',
                    role: 'assistant',
                    content: cleanResponse
                });
                
                // Execute shell command automatically
                await this.executeShellCommand(command);
            } else {
                // Regular response
                this._view.webview.postMessage({
                    type: 'addMessage',
                    role: 'assistant',
                    content: response
                });
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            this._view.webview.postMessage({
                type: 'addMessage',
                role: 'assistant',
                content: `❌ Error: ${errorMessage}\n\nMake sure LM Studio is running on localhost:1234`
            });
        } finally {
            this._view.webview.postMessage({
                type: 'setLoading',
                loading: false
            });
        }
    }

    async executeGitCommand(command) {
        if (!this._view) {
            return;
        }

        this._view.webview.postMessage({
            type: 'addMessage',
            role: 'system',
            content: `⚙️ Executing: \`${command}\``
        });

        try {
            const result = await this.gitService.executeCommand(command);
            
            // Add command result to LLM conversation history
            this.llmService.addCommandResult(command, result || 'Done', true);
            
            this._view.webview.postMessage({
                type: 'addMessage',
                role: 'system',
                content: `✅ Command executed successfully:\n\`\`\`\n${result || 'Done'}\n\`\`\``
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            
            // Add failed command to LLM conversation history
            this.llmService.addCommandResult(command, errorMessage, false);
            
            this._view.webview.postMessage({
                type: 'addMessage',
                role: 'system',
                content: `❌ Command failed:\n\`\`\`\n${errorMessage}\n\`\`\``
            });
        }
    }

    async executeShellCommand(command) {
        if (!this._view) {
            return;
        }

        this._view.webview.postMessage({
            type: 'addMessage',
            role: 'system',
            content: `📂 Running: \`${command}\``
        });

        try {
            const result = await this.gitService.executeShellCommand(command);
            
            // Add command result to LLM conversation history
            this.llmService.addCommandResult(command, result || 'Done', true);
            
            this._view.webview.postMessage({
                type: 'addMessage',
                role: 'system',
                content: `\`\`\`\n${result}\n\`\`\``
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            
            // Add failed command to LLM conversation history
            this.llmService.addCommandResult(command, errorMessage, false);
            
            this._view.webview.postMessage({
                type: 'addMessage',
                role: 'system',
                content: `❌ Command failed:\n\`\`\`\n${errorMessage}\n\`\`\``
            });
        }
    }
}

module.exports = { ChatViewProvider };
