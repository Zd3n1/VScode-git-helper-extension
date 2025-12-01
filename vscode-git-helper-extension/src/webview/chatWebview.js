function getWebviewContent(webview) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
    <title>Git Helper AI</title>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-sideBar-background);
            height: 100vh;
            display: flex;
            flex-direction: column;
        }

        .chat-container {
            flex: 1;
            overflow-y: auto;
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .message {
            padding: 10px 14px;
            border-radius: 8px;
            max-width: 95%;
            word-wrap: break-word;
            line-height: 1.5;
        }

        .message.user {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            align-self: flex-end;
            border-bottom-right-radius: 4px;
        }

        .message.assistant {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-widget-border);
            align-self: flex-start;
            border-bottom-left-radius: 4px;
        }

        .message.system {
            background-color: var(--vscode-editorInfo-background);
            border: 1px solid var(--vscode-editorInfo-foreground);
            align-self: center;
            font-size: 0.9em;
            text-align: center;
        }

        .message pre {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 8px;
            border-radius: 4px;
            overflow-x: auto;
            margin: 8px 0;
            font-family: var(--vscode-editor-font-family);
            font-size: 0.9em;
        }

        .message code {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 2px 6px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
        }

        .execute-btn {
            display: inline-block;
            margin-top: 10px;
            padding: 6px 12px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9em;
        }

        .execute-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .command-box {
            background-color: var(--vscode-terminal-background);
            border: 1px solid var(--vscode-terminal-border);
            padding: 8px 12px;
            border-radius: 4px;
            margin-top: 8px;
            font-family: var(--vscode-editor-font-family);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .command-text {
            flex: 1;
            color: var(--vscode-terminal-foreground);
        }

        .input-container {
            padding: 12px;
            background-color: var(--vscode-sideBar-background);
            border-top: 1px solid var(--vscode-widget-border);
        }

        .input-wrapper {
            display: flex;
            gap: 8px;
        }

        #messageInput {
            flex: 1;
            padding: 10px 12px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 6px;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            resize: none;
            min-height: 40px;
            max-height: 120px;
        }

        #messageInput:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }

        #sendBtn {
            padding: 10px 16px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: var(--vscode-font-size);
            display: flex;
            align-items: center;
            justify-content: center;
        }

        #sendBtn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        #sendBtn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .loading {
            display: none;
            padding: 10px;
            text-align: center;
            color: var(--vscode-descriptionForeground);
        }

        .loading.visible {
            display: block;
        }

        .loading-dots {
            display: inline-block;
        }

        .loading-dots span {
            animation: blink 1.4s infinite;
            animation-fill-mode: both;
        }

        .loading-dots span:nth-child(2) {
            animation-delay: 0.2s;
        }

        .loading-dots span:nth-child(3) {
            animation-delay: 0.4s;
        }

        @keyframes blink {
            0%, 80%, 100% { opacity: 0; }
            40% { opacity: 1; }
        }

        .welcome-message {
            text-align: center;
            padding: 20px;
            color: var(--vscode-descriptionForeground);
        }

        .welcome-message h2 {
            margin-bottom: 12px;
            color: var(--vscode-foreground);
        }

        .welcome-message p {
            margin-bottom: 8px;
        }

        .suggestions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 16px;
            justify-content: center;
        }

        .suggestion {
            padding: 6px 12px;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 16px;
            cursor: pointer;
            font-size: 0.85em;
        }

        .suggestion:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        .header-bar {
            display: flex;
            justify-content: flex-end;
            padding: 8px 12px;
            border-bottom: 1px solid var(--vscode-widget-border);
        }

        .clear-btn {
            padding: 4px 10px;
            background-color: transparent;
            color: var(--vscode-descriptionForeground);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.8em;
        }

        .clear-btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
            color: var(--vscode-foreground);
        }
    </style>
</head>
<body>
    <div class="header-bar">
        <button class="clear-btn" onclick="clearChat()">🗑️ Clear Chat</button>
    </div>
    <div class="chat-container" id="chatContainer">
        <div class="welcome-message">
            <h2>🤖 Git Helper AI</h2>
            <p>I'm here to help you with Git! Ask me anything or tell me what you want to do.</p>
            <p style="font-size: 0.85em; margin-top: 8px;">I remember our conversation, so feel free to ask follow-up questions!</p>
            <div class="suggestions">
                <div class="suggestion" onclick="sendSuggestion('What is git?')">What is git?</div>
                <div class="suggestion" onclick="sendSuggestion('Show my status')">Show status</div>
                <div class="suggestion" onclick="sendSuggestion('Commit my changes')">Commit changes</div>
                <div class="suggestion" onclick="sendSuggestion('What is a branch?')">What is a branch?</div>
                <div class="suggestion" onclick="sendSuggestion('Undo last commit')">Undo commit</div>
            </div>
        </div>
    </div>

    <div class="loading" id="loading">
        <span class="loading-dots"><span>.</span><span>.</span><span>.</span></span> Thinking...
    </div>

    <div class="input-container">
        <div class="input-wrapper">
            <textarea 
                id="messageInput" 
                placeholder="Ask about Git or describe what you want to do..."
                rows="1"
            ></textarea>
            <button id="sendBtn">Send</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const chatContainer = document.getElementById('chatContainer');
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const loading = document.getElementById('loading');

        let isLoading = false;

        // Auto-resize textarea
        messageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });

        // Send message on Enter (Shift+Enter for new line)
        messageInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        sendBtn.addEventListener('click', sendMessage);

        function sendMessage() {
            const message = messageInput.value.trim();
            if (!message || isLoading) return;

            // Clear welcome message on first message
            const welcome = chatContainer.querySelector('.welcome-message');
            if (welcome) {
                welcome.remove();
            }

            vscode.postMessage({
                type: 'sendMessage',
                message: message
            });

            messageInput.value = '';
            messageInput.style.height = 'auto';
        }

        function sendSuggestion(text) {
            messageInput.value = text;
            sendMessage();
        }

        function addMessage(role, content, suggestedCommand) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message ' + role;
            
            // Markdown rendering
            let html = content
                // Code blocks (must be first)
                .replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, '<pre>$1</pre>')
                // Inline code
                .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
                // Bold text **text**
                .replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>')
                // Italic text *text*
                .replace(/\\*([^*]+)\\*/g, '<em>$1</em>')
                // Numbered lists (1. item)
                .replace(/^(\\d+)\\.\\s+(.+)$/gm, '<div style="margin-left: 16px;"><strong>$1.</strong> $2</div>')
                // Bullet points (- item)
                .replace(/^-\\s+(.+)$/gm, '<div style="margin-left: 16px;">• $1</div>')
                // Line breaks
                .replace(/\\n/g, '<br>');
            
            messageDiv.innerHTML = html;

            // Add command execution button if there's a suggested command
            if (suggestedCommand) {
                const commandBox = document.createElement('div');
                commandBox.className = 'command-box';
                commandBox.innerHTML = \`
                    <span class="command-text">\${escapeHtml(suggestedCommand)}</span>
                    <button class="execute-btn" onclick="executeCommand('\${escapeHtml(suggestedCommand).replace(/'/g, "\\\\'")}')">▶ Run</button>
                \`;
                messageDiv.appendChild(commandBox);
            }

            chatContainer.appendChild(messageDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        function executeCommand(command) {
            vscode.postMessage({
                type: 'executeCommand',
                command: command
            });
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function setLoading(loading) {
            isLoading = loading;
            document.getElementById('loading').classList.toggle('visible', loading);
            sendBtn.disabled = loading;
        }

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'addMessage':
                    addMessage(message.role, message.content, message.suggestedCommand);
                    break;
                case 'setLoading':
                    setLoading(message.loading);
                    break;
            }
        });

        function clearChat() {
            // Clear UI
            chatContainer.innerHTML = \`
                <div class="welcome-message">
                    <h2>🤖 Git Helper AI</h2>
                    <p>I'm here to help you with Git! Ask me anything or tell me what you want to do.</p>
                    <p style="font-size: 0.85em; margin-top: 8px;">I remember our conversation, so feel free to ask follow-up questions!</p>
                    <div class="suggestions">
                        <div class="suggestion" onclick="sendSuggestion('What is git?')">What is git?</div>
                        <div class="suggestion" onclick="sendSuggestion('Show my status')">Show status</div>
                        <div class="suggestion" onclick="sendSuggestion('Commit my changes')">Commit changes</div>
                        <div class="suggestion" onclick="sendSuggestion('What is a branch?')">What is a branch?</div>
                        <div class="suggestion" onclick="sendSuggestion('Undo last commit')">Undo commit</div>
                    </div>
                </div>
            \`;
            
            // Clear conversation history in extension
            vscode.postMessage({ type: 'clearHistory' });
        }
    </script>
</body>
</html>`;
}

module.exports = { getWebviewContent };
