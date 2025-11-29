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
    console.log('Congratulations, your extension "ai-git-helper" is now active!');
    const disposable = vscode.commands.registerCommand('ai-git-helper.openChat', () => {
        const panel = vscode.window.createWebviewPanel('aiGitHelperChat', 'AI Git Helper', vscode.ViewColumn.One, {
            enableScripts: true
        });
        panel.webview.html = getWebviewContent();
    });
    context.subscriptions.push(disposable);
}
function deactivate() { }
function getWebviewContent() {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AI Git Helper</title>
        <style>
            /* Základní styly pro VS Code vzhled */
            body {
                font-family: var(--vscode-font-family);
                padding: 10px;
                background-color: var(--vscode-editor-background);
                color: var(--vscode-editor-foreground);
                display: flex;
                flex-direction: column;
                height: 95vh;
            }

            /* Oblast pro historii chatu */
            #chat-history {
                flex: 1;
                overflow-y: auto;
                margin-bottom: 20px;
                border: 1px solid var(--vscode-widget-border);
                padding: 10px;
                border-radius: 5px;
            }

            /* Jednotlivé zprávy */
            .message {
                margin-bottom: 10px;
                padding: 8px;
                border-radius: 5px;
            }
            .user-message {
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                align-self: flex-end;
                text-align: right;
            }
            .ai-message {
                background-color: var(--vscode-editor-inactiveSelectionBackground);
                align-self: flex-start;
            }

            /* Vstupní oblast (input + tlačítko) */
            .input-area {
                display: flex;
                gap: 10px;
            }
            
            textarea {
                flex: 1;
                background-color: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
                padding: 5px;
                resize: none;
                height: 40px;
                font-family: inherit;
            }

            button {
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                padding: 0 15px;
                cursor: pointer;
            }
            button:hover {
                background-color: var(--vscode-button-hoverBackground);
            }
        </style>
    </head>
    <body>
        <h2>🤖 AI Git Helper</h2>
        
        <div id="chat-history">
            <div class="message ai-message">Ahoj! Jsem tvůj Git asistent. S čím ti dnes mohu pomoci?</div>
        </div>

        <div class="input-area">
            <textarea id="chat-input" placeholder="Zeptej se na git příkaz..."></textarea>
            <button id="send-btn">Odeslat</button>
        </div>

        <script>
            // Získání přístupu k VS Code API uvnitř webview
            const vscode = acquireVsCodeApi();

            const sendBtn = document.getElementById('send-btn');
            const chatInput = document.getElementById('chat-input');
            const chatHistory = document.getElementById('chat-history');

            // Funkce pro přidání zprávy do chatu
            function addMessage(text, type) {
                const div = document.createElement('div');
                div.className = 'message ' + type;
                div.textContent = text;
                chatHistory.appendChild(div);
                chatHistory.scrollTop = chatHistory.scrollHeight; // Auto-scroll dolů
            }

            // Kliknutí na tlačítko Odeslat
            sendBtn.addEventListener('click', () => {
                const text = chatInput.value;
                if (text) {
                    // 1. Zobrazit zprávu uživatele
                    addMessage(text, 'user-message');
                    
                    // 2. Vyčistit input
                    chatInput.value = '';

                    // 3. Simulace odpovědi (ZATÍM JEN DISPLEJ, POZDĚJI AI)
                    setTimeout(() => {
                        addMessage('Zatím nejsem napojený na AI, ale slyším tě: ' + text, 'ai-message');
                    }, 500);
                }
            });

            // Odeslání pomocí Enteru (bez Shiftu)
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
//# sourceMappingURL=extension.js.map