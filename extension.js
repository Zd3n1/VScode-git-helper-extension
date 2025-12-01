const vscode = require('vscode');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const ChatViewProvider = require('./view/chat-view-provider');

// TODO: config file? env?
const LLM_URL = 'http://localhost:11434/api/generate';
const execAsync = util.promisify(exec);

async function activate(context) {

	const provider = new ChatViewProvider(context);

	context.subscriptions.push(
        vscode.window.registerWebviewViewProvider("chatView", provider)
    );

	console.log("Asking AI");

	const response = await axios.post(LLM_URL, {
		model: 'gittor',
		prompt: "Respond ONLY with a valid git command. No formatting. No markdown. Do not use character `. No explanation. Download me a Ktorfit repository from Foso.",
		stream: false
	});

	const reply = response.data.response || "(empty response)";
	console.log("AI replied: " + reply);

	// clean the command
	const command = sanitizeGitCommand(reply)

	// execute command
	const commandResult = await runCommand(command, vscode.workspace.rootPath);
	if (commandResult.error) {
		console.error("Git command failed:", commandResult.error, commandResult.stderr);
	} else {
		console.log("Git command output:", commandResult.stdout);
	}

	const disposable = vscode.commands.registerCommand('git-agent.askGittor', function () {
		vscode.window.showInformationMessage(reply);
	});

	context.subscriptions.push(disposable);
}


function deactivate() {

}


async function runCommand(cmd, cwd) {
	try {
		const { stdout, stderr } = await execAsync(cmd, { cwd });
		return { stdout, stderr, error: null };
	} catch (err) {
		return { stdout: err.stdout, stderr: err.stderr, error: err.message };
	}
}

function sanitizeGitCommand(cmd) {
    if (!cmd || typeof cmd !== "string") return "";

    return cmd
        .replace(/[`´]/g, "")      // zahodí backtick ` i akcent ´
        .replace(/[“”"']/g, "")    // zahodí všechny typy uvozovek
        .replace(/\s+/g, " ")      // normalizuje whitespace
        .trim();                    // ořeže začátek/konec
}

module.exports = {
	activate,
	deactivate
}
