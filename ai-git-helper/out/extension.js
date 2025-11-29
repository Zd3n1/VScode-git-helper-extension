"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
function activate(context) {
    console.log('Congratulations, your extension "ai-git-helper" is active in Sidebar!');
    // 1. Vytvoření instance našeho providera
    const provider = new SidebarProvider(context.extensionUri);
    // 2. Registrace providera do VS Code (ID musí odpovídat tomu v package.json -> views)
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('ai-git-helper.chatView', provider));
    // 3. Volitelný příkaz pro manuální otevření (kdyby uživatel nechtěl klikat myší)
    context.subscriptions.push(vscode.commands.registerCommand('ai-git-helper.openChat', () => {
        vscode.commands.executeCommand('ai-git-helper.chatView.focus');
    }));
}
function deactivate() { }
// Třída, která se stará o obsah v Side Baru
class SidebarProvider {
    _extensionUri;
    _view;
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        // Povolení skriptů v HTML
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        // Nastavení HTML obsahu
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    }
    _getHtmlForWebview(webview) {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>AI Git Helper</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    padding: 0;
                    margin: 0;
                    background-color: var(--vscode-sideBar-background); /* Barva pozadí sidebaru */
                    color: var(--vscode-sideBar-foreground);
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                }

                #chat-history {
                    flex: 1;
                    overflow-y: auto;
                    padding: 10px;
                }

                .message {
                    margin-bottom: 12px;
                    padding: 8px 12px;
                    border-radius: 6px;
                    font-size: 13px;
                    line-height: 1.4;
                    max-width: 90%;
                }
                
                .user-message {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    align-self: flex-end;
                    margin-left: auto; /* Zarovnání doprava */
                }
                
                .ai-message {
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                    align-self: flex-start;
                    margin-right: auto; /* Zarovnání doleva */
                    border: 1px solid var(--vscode-widget-border);
                }

                .input-area {
                    padding: 10px;
                    border-top: 1px solid var(--vscode-widget-border);
                    background-color: var(--vscode-sideBar-background);
                    display: flex;
                    flex-direction: column; 
                    gap: 8px;
                }

                textarea {
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    padding: 8px;
                    resize: vertical;
                    min-height: 60px;
                    border-radius: 4px;
                    font-family: inherit;
                }
                
                textarea:focus {
                    outline: 1px solid var(--vscode-focusBorder);
                }

                button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: bold;
                }
                
                button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
            </style>
        </head>
        <body>
            <div id="chat-history">
                <div class="message ai-message">👋 Hi! I'm your Git AI Agent. Ask me anything or use the buttons below.</div>
            </div>

            <div class="input-area">
                <textarea id="chat-input" placeholder="Ask e.g.: How to undo last commit?"></textarea>
                <button id="send-btn">Send</button>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                const sendBtn = document.getElementById('send-btn');
                const chatInput = document.getElementById('chat-input');
                const chatHistory = document.getElementById('chat-history');

                function addMessage(text, type) {
                    const div = document.createElement('div');
                    div.className = 'message ' + type;
                    div.textContent = text;
                    chatHistory.appendChild(div);
                    chatHistory.scrollTop = chatHistory.scrollHeight;
                }

                sendBtn.addEventListener('click', () => {
                    const text = chatInput.value;
                    if (text) {
                        addMessage(text, 'user-message');
                        chatInput.value = '';
                        
                        // Simulace odpovědi
                        setTimeout(() => {
                            addMessage('Processing: ' + text, 'ai-message');
                        }, 500);
                    }
                });

                chatInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendBtn.click();
                    }
                });
            </script>
        </body>
        </html>`;
    }
}
//# sourceMappingURL=extension.js.map