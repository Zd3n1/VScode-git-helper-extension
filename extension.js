// The module 'vscode' contains the VS Code extensibility API

// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const path = require('path');
const dotenv = require('dotenv');

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");

// preparing key for communication with gemini
const envPath = path.join(__dirname, '.env');
dotenv.config({ path: envPath });
const API_KEY = process.env.KEY;
const MODEL_NAME = "gemini-2.5-flash"

async function activate(context) {

    // checking if the API key and model name is correct
    // writing list of available models
    await checkConnectionWithStudio()

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	const provider = new GitAgentViewProvider(context.extensionUri);
	context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('gitAgentView', provider)
    );

}

async function checkConnectionWithStudio(){
if (!API_KEY) {
        console.error("Missing API key");
        return;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            console.log("--------------------------------------------------");
            console.log("List of models:");
            console.log("--------------------------------------------------");
            
            if (data.error) {
                console.error("Error API:", data.error.message);
            } else if (data.models) {
            
                data.models.forEach(model => {
                    console.log(`✅ ${model.name}`);
                });
                
        
                const hasFlash = data.models.some(m => m.name.includes(MODEL_NAME));
                console.log("--------------------------------------------------");
                if (!hasFlash) {
                    console.log(`Model ${MODEL_NAME} is not included.`);
                } 
            }
            console.log("--------------------------------------------------");
        })
        .catch(err => {
            console.error("Connection error:", err);
        });
}

class GitAgentViewProvider {
    constructor(extensionUri) {
        this._extensionUri = extensionUri;
        const genAI = new GoogleGenerativeAI(API_KEY);
        this._model = genAI.getGenerativeModel({ model: `${MODEL_NAME}` });
        
    }

    resolveWebviewView(webviewView) {
      this._view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this._getHtmlContent();

        webviewView.webview.onDidReceiveMessage(data => {
            if (data.type === 'userRequest') {
                this._handleUserRequestWithAI(data.value);
            }
        });
    }

    async _handleUserRequestWithAI(userText) {
        try {
            this._addMessageToChat('Agent', '🤔 Thinking...');

            const prompt = `
                You are a helper that translates human language into GIT commands.
                User says: "${userText}"
                
                Rules:
                1. Reply ONLY with the git command (e.g., "git status").
                2. Do not use markdown formatting (no backticks).
                3. If the request is dangerous (delete history etc.), reply with "SAFEGUARD_ERROR".
                4. If it is not related to git, reply with "UNKNOWN_COMMAND".
            `;

            const result = await this._model.generateContent(prompt);
            const command = result.response.text().trim();

            if (command === 'UNKNOWN_COMMAND') {
                this._addMessageToChat('Agent', "This isn't seem like task related to Git. Try it again.");
            } else if (command === 'SAFEGUARD_ERROR') {
                this._addMessageToChat('Agent', "This command seems dangerous, I'd rather not execute it.");
            } else {
                //command is valid
                this._executeGitCommand(command);
            }

        } catch (error) {
            this._addMessageToChat('Error', `Chyba AI: ${error.message}`);
        }
    }

    _executeGitCommand(command) {
        if (!vscode.workspace.workspaceFolders) {
            this._addMessageToChat('System', "⚠️ You don't have open any folder!");
            return;
        }
        const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

        this._addMessageToChat('Agent', `🚀 Running: ${command}`);

        // cp.exec(command, { cwd: rootPath }, (err, stdout, stderr) => {
        //     if (err) {
        //         this._addMessageToChat('Error', `Git Error: ${stderr || err.message}`);
        //     } else {
        //         this._addMessageToChat('Git', stdout || 'Done');
        //     }
        // });
        this._addMessageToChat('Agent', `Done`);
    }

    _addMessageToChat(sender, text) {
        if (this._view) {
            this._view.webview.postMessage({ type: 'addResponse', sender: sender, text: text });
        }
    }

    _getHtmlContent() {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <style>
                    body { font-family: sans-serif; padding: 10px; color: var(--vscode-editor-foreground); }
                    .chat-box { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
                    .msg { padding: 8px; border-radius: 5px; font-size: 13px; }
                    .msg.user { background: #007acc; color: white; align-self: flex-end; }
                    .msg.agent { background: #3c3c3c; align-self: flex-start; border-left: 3px solid #007acc; }
                    .msg.git { background: #222; font-family: monospace; white-space: pre-wrap; border: 1px solid #444; }
                    .msg.error { background: #5a1e1e; color: #ffcccc; }
                    
                    textarea { width: 100%; height: 50px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); margin-bottom: 5px; box-sizing: border-box; }
                    button { width: 100%; padding: 8px; background: var(--vscode-button-background); color: white; border: none; cursor: pointer; }
                    button:hover { background: var(--vscode-button-hoverBackground); }
                </style>
            </head>
            <body>
                <h3>🤖 Git Helper</h3>
                <div class="chat-box" id="chat-log"></div>
                
                <textarea id="prompt" placeholder="Hello, I'm here to help you with the git 🚀 Ask me a question or tell me what to do."></textarea>
                <button id="sendBtn">Odeslat</button>

                <script>
                    const vscode = acquireVsCodeApi();
                    const log = document.getElementById('chat-log');
                    const input = document.getElementById('prompt');
                    const btn = document.getElementById('sendBtn');

            
                    btn.addEventListener('click', () => {
                        const text = input.value;
                        if(text) {
                            addMessage('You', text, 'user');
                            vscode.postMessage({ type: 'userRequest', value: text });
                            input.value = '';
                        }
                    });

            
                    window.addEventListener('message', event => {
                        const message = event.data;
                        if (message.type === 'addResponse') {
                            let style = 'agent';
                            if (message.sender === 'Git') style = 'git';
                            if (message.sender === 'Error') style = 'error';
                            addMessage(message.sender, message.text, style);
                        }
                    });

                    function addMessage(sender, text, type) {
                        const div = document.createElement('div');
                        div.className = 'msg ' + type;
                        div.innerText = (type === 'git' ? '' : sender + ': ') + text;
                        log.appendChild(div);
                        window.scrollTo(0, document.body.scrollHeight);
                    }
                </script>
            </body>
            </html>
        `;
    }
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
