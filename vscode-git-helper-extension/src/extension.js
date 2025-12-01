const vscode = require('vscode');
const { ChatViewProvider } = require('./providers/ChatViewProvider');
const { GitService } = require('./services/GitService');

function activate(context) {
    console.log('Git Helper AI extension is now active!');

    const gitService = new GitService();
    const chatViewProvider = new ChatViewProvider(context.extensionUri, gitService);

    // Register the webview provider for the sidebar
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'git-helper-chat',
            chatViewProvider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            }
        )
    );

    // Register command to open chat
    context.subscriptions.push(
        vscode.commands.registerCommand('git-helper.openChat', () => {
            vscode.commands.executeCommand('workbench.view.extension.git-helper-sidebar');
        })
    );

    // Show welcome message
    vscode.window.showInformationMessage('Git Helper AI is ready! Open the sidebar to start chatting.');
}

function deactivate() {
    console.log('Git Helper AI extension deactivated');
}

module.exports = { activate, deactivate };
