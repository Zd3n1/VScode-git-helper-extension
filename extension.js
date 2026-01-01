// The module 'vscode' contains the VS Code extensibility API

// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const path = require('path');
const dotenv = require('dotenv');
const HTML_CONTENT = require('./htmlContent')
const cp = require('child_process');
const fs = require('fs');
const util = require('util');
const {generatePrompt} = require('./utils/generatePrompt')
const exec = util.promisify(cp.exec);

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");

// preparing key for communication with gemini
const envPath = path.join(__dirname, '.env');
dotenv.config({ path: envPath });
const API_KEY = process.env.KEY;
const MODEL_NAME = "gemini-2.5-flash"

async function activate(context) {

    // checking if the API key and model name is correct
    // writing list of available models
    await checkConnectionWithStudio()

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	const provider = new GitAgentViewProvider(context.extensionUri);
	context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('gitAgentView', provider)
    );

}

async function checkConnectionWithStudio(){
if (!API_KEY) {
        console.error("Missing API key");
        return;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            _logInitialInformation(data)
        })
        .catch(err => {
            console.error("Connection error:", err);
        });
}

function _logInitialInformation(data){
    console.log("--------------------------------------------------");
    console.log("List of models:");
    console.log("--------------------------------------------------");
    
    if (data.error) {
        console.error("Error API:", data.error.message);
    } else if (data.models) {
    
        data.models.forEach(model => {
            console.log(`✅ ${model.name}`);
        });
        

        const hasFlash = data.models.some(m => m.name.includes(MODEL_NAME));
        console.log("--------------------------------------------------");
        if (!hasFlash) {
            console.log(`Model ${MODEL_NAME} is not included.`);
        } 
    }
    console.log("--------------------------------------------------");
}

class GitAgentViewProvider {
    constructor(extensionUri, isGit) {
        this._extensionUri = extensionUri;
        const genAI = new GoogleGenerativeAI(API_KEY);
        this._model = genAI.getGenerativeModel({ model: `${MODEL_NAME}` });
        this._isGit = isGit
    }

    async resolveWebviewView(webviewView) {
      this._view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this._getHtmlContent();

        webviewView.webview.onDidReceiveMessage(async data => {
            if (data.type === 'webviewLoaded'){
                await this._checkWorkspace()
            }
            if (data.type === 'userRequest') {
                this._handleUserRequestWithAI(data.value);
            }
            if (data.type === 'changeModel') {
                this._changeModel(data.value)
            }
        });
    }

    _changeModel(newModelName){
        const genAI = new GoogleGenerativeAI(API_KEY);
        this._model = genAI.getGenerativeModel({ model: newModelName });
        console.log(`Model switched to: ${newModelName}`);
    }

    async _checkWorkspace(){
         if (!vscode.workspace.workspaceFolders) {
            this._addMessageToChat('System', "⚠️ You don't have open any folder");
            this._disableButtons(['btn-status', 'btn-commit', 'btn-push', 'btn-sync', 'btn-checkout']);
        } else {
            const isGit = await this._isGitRepository()
            if(!isGit){
                this._addMessageToChat('System', "Current folder is not a Git repository.");
                this._disableButtons(['btn-status', 'btn-commit', 'btn-push', 'btn-sync', 'btn-checkout']);
            }
        }
    }

    async _isGitRepository(){
        const folderPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        try {
            const { stdout } = await exec('git rev-parse --is-inside-work-tree', { cwd: folderPath });
            return stdout.trim() === 'true';
        } catch (e){
            return false
        }
    }
    

    _disableButtons(idsArray){
        if (this._view) {
            this._view.webview.postMessage({ 
                type: 'setButtonsState', 
                disable: idsArray.includes('all') ? [
                    'btn-status', 'btn-commit', 'btn-push', 'btn-sync', 'btn-checkout', 'sendBtn'
                ] : idsArray 
            });
        }
    }

    async _handleUserRequestWithAI(userText) {
        try {
            this._disableButtons(['all'])
            this._addMessageToChat('Agent', '🤔 Thinking...');

            const prompt = generatePrompt(userText);

            const response = await this._model.generateContent(prompt);
            const result = response.response.text().trim();
            const resultObject = JSON.parse(result)
            /* result object has 3 attributes: message, command, isDangerous */

            if (resultObject.message){
                this._addMessageToChat('Agent', resultObject.message)
                if(resultObject.command){
                    this._executeGitCommand(resultObject.command, resultObject.isDangerous)
                }
            }

        } catch (error) {
            this._addMessageToChat('Error', `Chyba AI: ${error.message}`);
        } finally {
            this._disableButtons([])
        }
    }

    _executeGitCommand(command, isDangerous) {
        if (!vscode.workspace.workspaceFolders) {
            this._addMessageToChat('System', "⚠️ You don't have open any folder!");
            return;
        }
        const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

        this._addMessageToChat('Agent', `🚀 Running: ${command}`);

        // cp.exec(command, { cwd: rootPath }, (err, stdout, stderr) => {
        //     if (err) {
        //         this._addMessageToChat('Error', `Git Error: ${stderr || err.message}`);
        //     } else {
        //         this._addMessageToChat('Git', stdout || 'Done');
        //     }
        // });
        if(command.includes('git clone')){
            this._disableButtons([])
        }
        this._addMessageToChat('Agent', `Done`);
    }

    _addMessageToChat(sender, text) {
        if (this._view) {
            this._view.webview.postMessage({ type: 'addResponse', sender: sender, text: text });
        }
    }

    _getHtmlContent() {
        return HTML_CONTENT;
    }
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
