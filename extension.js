const vscode = require('vscode');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	console.log('Congratulations, your extension "git-agent" is now active!');

	const disposable = vscode.commands.registerCommand('git-agent.helloWorld', function () {
		vscode.window.showInformationMessage('Hello World from git-agent!');
	});

	context.subscriptions.push(disposable);
}


function deactivate() {

}

module.exports = {
	activate,
	deactivate
}
