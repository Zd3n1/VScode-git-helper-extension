const vscode = require('vscode');
const axios = require('axios');

// TODO: config file? env?
const LLM_URL = 'http://localhost:11434/api/generate';

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {

	console.log("Asking AI");

	const response = await axios.post(LLM_URL, {
		model: 'gittor',
		message: [
			{"role": "user", "content": "Introduce yourself"}
		],
		stream: false
	});

	const reply = response.data.message?.content || "(empty response)";
	console.log("AI replied: " + reply);

	const disposable = vscode.commands.registerCommand('git-agent.askGittor', function () {
		vscode.window.showInformationMessage(reply);
	});

	context.subscriptions.push(disposable);
}


function deactivate() {

}

module.exports = {
	activate,
	deactivate
}
