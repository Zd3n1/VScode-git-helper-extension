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

        .model-select, .history-select {
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
        .model-select:focus, .history-select:focus {
            border-color: var(--vscode-focusBorder);
        }
        
        .history-container {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid var(--vscode-widget-border);
        }
        
        .history-select {
            flex: 1;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .btn-new-chat {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 4px 10px;
            cursor: pointer;
            border-radius: 4px;
            font-size: 11px;
            white-space: nowrap;
        }
        .btn-new-chat:hover {
            background: var(--vscode-button-secondaryHoverBackground);
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

        .msg-actions {
            display: flex;
            gap: 8px;
            margin-top: 10px;
            flex-wrap: wrap;
        }

        .btn-action {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 4px 12px;
            cursor: pointer;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 500;
            transition: opacity 0.2s;
        }

        .btn-action:hover {
            opacity: 0.9;
        }

        .btn-action.secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
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
            flex-shrink: 0;
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
        
        <div class="history-container">
            <select id="historySelect" class="history-select">
                <option value="current">Current Chat</option>
            </select>
            <button id="btnNewChat" class="btn-new-chat">+ New</button>
        </div>

        <p>Quick actions: </p>
        <div class="quick-buttons">
            <button id="btn-status" class="btn-quick" onclick="runGit('status')">Git Status</button>
            <button id="btn-commit" class="btn-quick" onclick="runGit('generateCommit')">Commit</button>
            <button id="btn-push" class="btn-quick" onclick="runGit('pushCommit')">Push</button>
            <button id="btn-sync" class="btn-quick" onclick="runGit('sync')">Sync</button>
            <button id="btn-new-branch-checkout" class="btn-quick" onclick="runGit('newBranchCheckout')">New Branch Checkout</button>
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
        const historySelect = document.getElementById('historySelect');
        const btnNewChat = document.getElementById('btnNewChat');

        vscode.postMessage({ type: 'webviewLoaded' });

        modelSelect.addEventListener('change', () => {
            const selectedModel = modelSelect.value;
            vscode.postMessage({ type: 'changeModel', value: selectedModel });
        });
        
        historySelect.addEventListener('change', () => {
            const selectedSessionId = historySelect.value;
            if (selectedSessionId !== 'current') {
                vscode.postMessage({ type: 'loadHistory', sessionId: selectedSessionId });
            }
        });
        
        btnNewChat.addEventListener('click', () => {
            vscode.postMessage({ type: 'newChat' });
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

        window.runGit = (action) => {
                let userText = "";
                let command = "";
                
            if (action === 'status') {
                userText = "Show me git status";
                command = action; 
            } 
            else if (action === 'generateCommit') {
                userText = "Generate commit message based on changes";
                command = action; 
            }
            else if (action === 'pushCommit') {
                userText = "Push commits to the remote repository";
                command = action; 
            } 
            else if (action === 'sync') {
                userText = "Sync changes from the remote repository";
                command = action; 
            } 
            else if (action === 'newBranchCheckout') {
                userText = "I want to create a new branch and switch to it"; 
                command = action; 
            }
                
                addMessage('You', userText, 'user');
                vscode.postMessage({ type: 'quickButton', value: userText, command: command });
        }

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'addResponse') {
                let style = 'agent';
                if (message.sender === 'Git') style = 'git';
                if (message.sender === 'Error') style = 'error';
                addMessage(message.sender, message.text, style, message.actions); 
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
            if (message.type === 'updateHistoryList') {
                updateHistoryDropdown(message.sessions);
            }
            if (message.type === 'clearChat') {
                log.innerHTML = '';
            }
            if (message.type === 'loadChatHistory') {
                log.innerHTML = '';
                if (message.messages && message.messages.length > 0) {
                    message.messages.forEach(msg => {
                        addMessage(msg.sender, msg.text, msg.style, msg.actions || []);
                    });
                }
            }
        });

        function addMessage(sender, text, type, actions = []) {
            const wrapper = document.createElement('div');
            wrapper.className = 'message-wrapper ' + type;

            const nameSpan = document.createElement('span');
            nameSpan.className = 'sender-name';
            nameSpan.innerText = sender;
            
            const msgDiv = document.createElement('div');
            msgDiv.className = 'msg ' + type;
            msgDiv.innerText = text;

            if (actions && actions.length > 0) {
                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'msg-actions';
                
                actions.forEach(action => {
                    const btn = document.createElement('button');
                    btn.className = 'btn-action' + (action.secondary ? ' secondary' : '');
                    btn.innerText = action.label;
                    btn.onclick = () => {
                        vscode.postMessage({ 
                            type: 'actionButton', 
                            command: action.command 
                        });
                        actionsDiv.style.pointerEvents = 'none';
                        actionsDiv.style.opacity = '0.5';
                    };
                    actionsDiv.appendChild(btn);
                });
                msgDiv.appendChild(actionsDiv);
            }

            wrapper.appendChild(nameSpan);
            wrapper.appendChild(msgDiv);
            log.appendChild(wrapper);
            log.scrollTop = log.scrollHeight;
        }
        
        function updateHistoryDropdown(sessions) {
            historySelect.innerHTML = '<option value="current">📝 Current Chat</option>';
            if (sessions && sessions.length > 0) {
                sessions.forEach(session => {
                    const option = document.createElement('option');
                    option.value = session.id;
                    option.textContent = session.displayName || session.name;
                    historySelect.appendChild(option);
                });
            }
        }
    </script>
</body>
</html>
`;