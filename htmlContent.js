module.exports = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        :root {
            --user-bg: #007acc;
            --user-fg: #ffffff;
            --agent-bg: var(--vscode-editor-inactiveSelectionBackground);
            --agent-fg: var(--vscode-editor-foreground);
            --border-radius: 12px;
        }

        body { 
            font-family: var(--vscode-font-family); 
            padding: 0; 
            margin: 0;
            color: var(--vscode-editor-foreground); 
            display: flex;
            flex-direction: column;
            height: 100vh;
            overflow: hidden;
        }

        .header {
            padding: 15px;
            border-bottom: 1px solid var(--vscode-widget-border);
            background: var(--vscode-editor-background);
        }
        
        .header-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }

        h3 { margin: 0; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 8px;}

        .model-select {
            background: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            border: 1px solid var(--vscode-dropdown-border);
            padding: 4px 8px;
            border-radius: 4px;
            font-family: var(--vscode-font-family);
            font-size: 12px;
            outline: none;
            cursor: pointer;
        }
        .model-select:focus {
            border-color: var(--vscode-focusBorder);
        }

        p { margin: 0 0 8px 0; font-size: 11px; opacity: 0.7; }

        .quick-buttons { 
            display: flex; 
            gap: 8px; 
            flex-wrap: wrap; 
        }

        .btn-quick { 
            background: var(--vscode-button-secondaryBackground); 
            color: var(--vscode-button-secondaryForeground); 
            border: none; 
            padding: 6px 12px; 
            cursor: pointer; 
            border-radius: 15px;
            font-size: 11px;
            font-weight: 500;
            transition: background 0.2s;
        }
        .btn-quick:hover { background: var(--vscode-button-secondaryHoverBackground); }
        .btn-quick:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            background: var(--vscode-editor-inactiveSelectionBackground);
            color: var(--vscode-disabledForeground);
        }

        .chat-box { 
            flex: 1; 
            overflow-y: auto; 
            padding: 15px; 
            display: flex; 
            flex-direction: column; 
            gap: 15px; 
        }

        .message-wrapper {
            display: flex;
            flex-direction: column;
            max-width: 85%;
        }

        .message-wrapper.user { align-self: flex-end; align-items: flex-end; }
        .message-wrapper.agent, .message-wrapper.git, .message-wrapper.error { align-self: flex-start; align-items: flex-start; }

        .sender-name {
            font-size: 10px;
            margin-bottom: 4px;
            opacity: 0.6;
            margin-left: 5px;
            margin-right: 5px;
        }

        .msg { 
            padding: 10px 14px; 
            font-size: 13px; 
            line-height: 1.4;
            word-wrap: break-word;
        }

        .msg.user { 
            background: var(--user-bg); 
            color: var(--user-fg); 
            border-radius: var(--border-radius) var(--border-radius) 2px var(--border-radius);
        }

        .msg.agent { 
            background: var(--agent-bg); 
            color: var(--agent-fg); 
            border-radius: var(--border-radius) var(--border-radius) var(--border-radius) 2px;
        }

        .msg.git { 
            background: #1e1e1e; 
            border: 1px solid #333;
            font-family: 'Courier New', monospace; 
            border-radius: 8px;
            white-space: pre-wrap;
        }

        .msg.error { 
            background: rgba(255, 0, 0, 0.2); 
            color: #ffcccc; 
            border: 1px solid rgba(255, 0, 0, 0.4);
            border-radius: 8px;
        }

        .input-container {
            padding: 15px;
            background: var(--vscode-editor-background);
            border-top: 1px solid var(--vscode-widget-border);
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .input-wrapper {
            display: flex;
            gap: 10px;
            align-items: flex-end;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 6px;
            padding: 5px;
        }

        .input-wrapper:focus-within {
            border-color: var(--vscode-focusBorder);
        }

        textarea { 
            flex: 1;
            background: transparent;
            color: var(--vscode-input-foreground); 
            border: none; 
            resize: none;
            outline: none;
            padding: 8px;
            font-family: var(--vscode-font-family);
            font-size: 13px;
            max-height: 120px; 
            overflow-y: hidden; 
            height: 20px; 
            box-sizing: content-box; 
        }

        #sendBtn { 
            width: auto; 
            padding: 6px 14px; 
            height: 32px;
            background: var(--vscode-button-background); 
            color: var(--vscode-button-foreground); 
            border: none; 
            cursor: pointer; 
            border-radius: 4px;
            font-size: 12px;
            margin-bottom: 2px;
        }
        #sendBtn:hover { background: var(--vscode-button-hoverBackground); }
        #sendBtn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

    </style>
</head>
<body>
    
    <div class="header">
        <div class="header-top">
            <h3>🤖 Git Helper</h3>
            <select id="modelSelect" class="model-select">
                <option value="gemini-2.5-flash" selected>⚡ Gemini Flash</option>
                <option value="gemini-2.5-pro">🧠 Gemini Pro</option>
            </select>
        </div>

        <p>Quick actions: </p>
        <div class="quick-buttons">
            <button id="btn-status" class="btn-quick" onclick="runGit('status')">Status</button>
            <button id="btn-history" class="btn-quick" onclick="runGit('history')">History</button>
            <button id="btn-commit" class="btn-quick" onclick="runGit('generateCommit')">Commit</button>
            <button id="btn-push" class="btn-quick" onclick="runGit('pushCommit')">Push</button>
            <button id="btn-pull" class="btn-quick" onclick="runGit('pull')">Pull</button>
            <button id="btn-fetch" class="btn-quick" onclick="runGit('fetch')">Fetch</button>
            <button id="btn-checkout" class="btn-quick" onclick="runGit('checkout')">Checkout branch</button>
        </div>
    </div>

    <div class="chat-box" id="chat-log">
        </div>
    
    <div class="input-container">
        <div class="input-wrapper">
            <textarea id="prompt" rows="1" placeholder="Ask about Git or what AI should do..."></textarea>
            <button id="sendBtn">Send</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const log = document.getElementById('chat-log');
        const input = document.getElementById('prompt');
        const btn = document.getElementById('sendBtn');
        const modelSelect = document.getElementById('modelSelect');

        vscode.postMessage({ type: 'webviewLoaded' });

        modelSelect.addEventListener('change', () => {
            const selectedModel = modelSelect.value;
            vscode.postMessage({ type: 'changeModel', value: selectedModel });
        });

        input.addEventListener('input', function() {
            this.style.height = 'auto'; 
            this.style.height = (this.scrollHeight) + 'px';
            
            if(this.value === '') {
                    this.style.height = '20px';
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        btn.addEventListener('click', sendMessage);

        function sendMessage() {
            const text = input.value.trim();
            if(text) {
                addMessage('You', text, 'user');
                vscode.postMessage({ type: 'userRequest', value: text });
                input.value = '';
                input.style.height = '20px';
            }
        }

        window.runGit = (command) => {
            let userText = "";
            
            if (command === 'status') {
                userText = "Show me git status";
            } 
            else if (command === 'history') {
                userText = "Show me recent commit history in pretty format with authors and with short dates";
            } 
            else if (command === 'generateCommit') {
                userText = "Generate commit message based on changes";
            }
            else if (command === 'pushCommit') {
                userText = "Push commits to the remote repository";
            } 
            else if (command === 'pull') {
                userText = "Pull changes from the remote repository";
            } 
            else if (command === 'fetch') {
                userText = "Fetch latest info from remote (git fetch)";
            } 
            else if (command === 'checkout') {
                userText = "I want to switch to another branch"; 
            }
                
                addMessage('You', userText, 'user');
                vscode.postMessage({ type: 'userRequest', value: userText });
        }

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'addResponse') {
                let style = 'agent';
                if (message.sender === 'Git') style = 'git';
                if (message.sender === 'Error') style = 'error';
                addMessage(message.sender, message.text, style);
            }
            if (message.type === 'setButtonsState'){
                const buttonsToDisable = message.disable;
                document.querySelectorAll('.btn-quick').forEach(b => b.disabled = false)
                document.querySelector('#sendBtn').disabled = false
                if (buttonsToDisable && Array.isArray(buttonsToDisable)) {
                    buttonsToDisable.forEach(id => {
                        const el = document.getElementById(id);
                        if (el) el.disabled = true;
                    });
                }
            }
        });

        function addMessage(sender, text, type) {
            const wrapper = document.createElement('div');
            wrapper.className = 'message-wrapper ' + type;

            const nameSpan = document.createElement('span');
            nameSpan.className = 'sender-name';
            nameSpan.innerText = sender;
            
            const msgDiv = document.createElement('div');
            msgDiv.className = 'msg ' + type;
            msgDiv.innerText = text;

            wrapper.appendChild(nameSpan);
            wrapper.appendChild(msgDiv);
            
            log.appendChild(wrapper);
            
            log.scrollTop = log.scrollHeight;
        }
    </script>
</body>
</html>
`;