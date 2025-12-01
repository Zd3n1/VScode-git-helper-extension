const vscode = require('vscode');

class ChatViewProvider {
    static viewType = 'chatView';  // Tohle musí sedět!

    constructor(context) {
        this.context = context;
    }

    resolveWebviewView(webviewView) {
        webviewView.webview.options = { enableScripts: true };

        webviewView.webview.html = `
            <html>
                <body>
                    <h2>Git Chat</h2>
                </body>
            </html>`;
    }
}

module.exports = ChatViewProvider;