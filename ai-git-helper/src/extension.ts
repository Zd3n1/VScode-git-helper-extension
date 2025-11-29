import * as vscode from 'vscode';
import * as cp from 'child_process'; 

export function activate(context: vscode.ExtensionContext) {
    console.log('AI Git Helper is fully active!');

    const provider = new SidebarProvider(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('ai-git-helper.chatView', provider)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ai-git-helper.openChat', () => {
            vscode.commands.executeCommand('ai-git-helper.chatView.focus');
        })
    );
}

class SidebarProvider implements vscode.WebviewViewProvider {
    _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            if (data.type === 'askAI') {
                await this.handleAiRequest(webviewView, data.value);
            } 
            else if (data.type === 'gitCommand') {
                await this.handleGitCommand(webviewView, data.command, data.args);
            }
        });
    }

    private async handleGitCommand(webviewView: vscode.WebviewView, command: string, args?: string) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            webviewView.webview.postMessage({ type: 'addResponse', value: '⚠️ Please open the project folder first.' });
            return;
        }
        const rootPath = workspaceFolders[0].uri.fsPath;

        try {
            if (command === 'status') {
                const result = await this.runGit(['status'], rootPath);
                webviewView.webview.postMessage({ type: 'addResponse', value: `📂 **Git Status:**\n\n${result}` });
            } 
            else if (command === 'generateCommit') {
                const diff = await this.runGit(['diff', '--staged'], rootPath);
                
                if (!diff || diff.trim() === '') {
                    webviewView.webview.postMessage({ type: 'addResponse', value: '⚠️ No staged changes. Use "git add" first.' });
                    return;
                }

                webviewView.webview.postMessage({ type: 'addResponse', value: '🤖 Analyzing changes...' });
                
                const prompt = `Generate a short git commit message (max 50 chars) based on this diff. Output ONLY the raw text, no quotes, no markdown.\n\n${diff}`;
                let aiMsg = await this.askOllama(prompt);
                
                aiMsg = aiMsg.trim().replace(/["`]/g, '');

                webviewView.webview.postMessage({ 
                    type: 'commitSuggestion', 
                    value: aiMsg 
                });
            }
            else if (command === 'performCommit') {
                if (!args) {return;}
                
                webviewView.webview.postMessage({ type: 'addResponse', value: `⚙️ Committing: "${args}"...` });
                
                await this.runGit(['commit', '-m', args], rootPath);
                
                webviewView.webview.postMessage({ type: 'addResponse', value: '✅ **Success!** Changes have been committed.' });

                webviewView.webview.postMessage({ type: 'offerPush' });
            }
            else if (command === 'push') {
                webviewView.webview.postMessage({ type: 'addResponse', value: '⬆️ Pushing changes to remote...' });
                
                await this.runGit(['push'], rootPath);
                
                webviewView.webview.postMessage({ type: 'addResponse', value: '✅ **Push Successful!** Your code is on the server.' });
            }

        } catch (error: any) {
            webviewView.webview.postMessage({ type: 'addResponse', value: `❌ Error: ${error.message}` });
        }
    }

    private runGit(args: string[], cwd: string): Promise<string> {
        return new Promise((resolve, reject) => {
            cp.execFile('git', args, { cwd: cwd }, (err, stdout, stderr) => {
                if (err) {
                    reject(new Error(stderr || err.message));
                } else {
                    resolve(stdout);
                }
            });
        });
    }

    private async handleAiRequest(webviewView: vscode.WebviewView, userPrompt: string) {
        try {
            const aiResponse = await this.askOllama(userPrompt);
            webviewView.webview.postMessage({ type: 'addResponse', value: aiResponse });
        } catch (error) {
            webviewView.webview.postMessage({ type: 'addResponse', value: '⚠️ Error: Cannot connect to Ollama.' });
        }
    }

    private async askOllama(prompt: string): Promise<string> {
        const modelName = 'qwen2.5-coder:1.5b'; 
        const apiUrl = 'http://localhost:11434/api/chat';
        const systemMessage = "You are a helpful AI Git Expert. Answer briefly in English. Use Markdown.";

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: modelName,
                messages: [
                    { role: "system", content: systemMessage },
                    { role: "user", content: prompt }
                ],
                stream: false
            })
        });

        if (!response.ok) {throw new Error('Ollama API Error');}
        const json = await response.json() as any;
        return json.message.content;
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: var(--vscode-font-family); background-color: var(--vscode-sideBar-background); color: var(--vscode-sideBar-foreground); display: flex; flex-direction: column; height: 100vh; margin: 0; }
                
                .quick-buttons { padding: 10px; display: flex; gap: 5px; flex-wrap: wrap; border-bottom: 1px solid var(--vscode-widget-border); }
                .btn-quick { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px; font-size: 11px; }
                .btn-quick:hover { background: var(--vscode-button-secondaryHoverBackground); }

                #chat-history { flex: 1; overflow-y: auto; padding: 10px; }
                .message { margin-bottom: 12px; padding: 8px; border-radius: 6px; font-size: 13px; max-width: 90%; word-wrap: break-word; }
                .user-message { background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); align-self: flex-end; margin-left: auto; }
                .ai-message { background-color: var(--vscode-editor-inactiveSelectionBackground); border: 1px solid var(--vscode-widget-border); }

                /* Buttons */
                .suggestion-box { border: 1px solid #4caf50; padding: 10px; background: rgba(76, 175, 80, 0.1); }
                .btn-commit { background: #4caf50; color: white; border: none; padding: 6px 12px; margin-top: 8px; cursor: pointer; width: 100%; border-radius: 3px; font-weight: bold; }
                .btn-commit:hover { background: #45a049; }
                
                /* Push button in the chat */
                .btn-push { background: #007acc; color: white; border: none; padding: 6px 12px; margin-top: 8px; cursor: pointer; width: 100%; border-radius: 3px; font-weight: bold; }
                .btn-push:hover { background: #0062a3; }

                .input-area { padding: 10px; border-top: 1px solid var(--vscode-widget-border); display: flex; gap: 5px; }
                textarea { flex: 1; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 5px; resize: none; height: 40px; }
                button#send-btn { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 0 15px; cursor: pointer; }
            </style>
        </head>
        <body>
            <div class="quick-buttons">
                <button class="btn-quick" onclick="runGit('status')">Git Status</button>
                <button class="btn-quick" onclick="runGit('generateCommit')">✨ Generate Commit</button>
            </div>

            <div id="chat-history">
                <div class="message ai-message">Hello! I am ready to help you with Git.</div>
            </div>

            <div class="input-area">
                <textarea id="chat-input" placeholder="Ask about Git..."></textarea>
                <button id="send-btn">Send</button>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                const chatHistory = document.getElementById('chat-history');

                function addMessage(text, type, isHtml = false) {
                    const div = document.createElement('div');
                    div.className = 'message ' + type;
                    if (isHtml) {
                        div.innerHTML = text;
                    } else {
                        div.innerHTML = text.replace(/\\n/g, '<br>'); 
                    }
                    chatHistory.appendChild(div);
                    chatHistory.scrollTop = chatHistory.scrollHeight;
                }

                function runGit(command, args = null) {
                    if (command !== 'performCommit') {
                        addMessage('Executing: ' + command + '...', 'user-message');
                    }
                    vscode.postMessage({ type: 'gitCommand', command: command, args: args });
                }

                document.getElementById('send-btn').addEventListener('click', () => {
                    const val = document.getElementById('chat-input').value;
                    if(val) {
                        addMessage(val, 'user-message');
                        document.getElementById('chat-input').value = '';
                        vscode.postMessage({ type: 'askAI', value: val });
                    }
                });

                document.getElementById('chat-input').addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault(); 
                        document.getElementById('send-btn').click(); 
                    }
                });

                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    if (message.type === 'addResponse') {
                        addMessage(message.value, 'ai-message');
                    }
                    else if (message.type === 'commitSuggestion') {
                        const htmlContent = \`
                            <div><strong>Suggested Message:</strong></div>
                            <div style="font-style: italic; margin: 5px 0;">"\${message.value}"</div>
                            <button class="btn-commit" onclick="runGit('performCommit', '\${message.value}')">✅ Confirm & Commit</button>
                        \`;
                        addMessage(htmlContent, 'ai-message suggestion-box', true);
                    }
                    else if (message.type === 'offerPush') {
                         const htmlContent = \`
                            <div>Commit created successfully! Do you want to push now?</div>
                            <button class="btn-push" onclick="runGit('push')">⬆️ Push to Remote</button>
                        \`;
                        addMessage(htmlContent, 'ai-message', true);
                    }
                });
            </script>
        </body>
        </html>`;
    }
}