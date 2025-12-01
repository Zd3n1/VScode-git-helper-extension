const vscode = require('vscode');
const https = require('https');
const http = require('http');

class LLMService {
    constructor() {
        this.conversationHistory = [];
        this.maxHistoryLength = 20; // Keep last 20 messages for context
    }

    getConfig() {
        const config = vscode.workspace.getConfiguration('gitHelper');
        return {
            endpoint: config.get('llmEndpoint', 'http://localhost:1234/v1/chat/completions'),
            model: config.get('model', 'openai/gpt-oss-20b'),
            maxTokens: config.get('maxTokens', 2000),
            temperature: config.get('temperature', 0.7)
        };
    }

    getSystemPrompt(workspaceInfo) {
        return `You are Git Helper AI, a friendly assistant for Git beginners.

WORKSPACE: ${workspaceInfo}

STRICT RULES:
1. ONE command only per response
2. NO markdown code blocks - no \`\`\`bash or \`\`\` blocks
3. NO numbered lists or step-by-step instructions
4. NO JSON output
5. Just: brief explanation + command tag

COMMANDS:
- Git: [EXECUTE_GIT]git command[/EXECUTE_GIT]
- Shell: [EXECUTE_SHELL]command[/EXECUTE_SHELL]
  Allowed: ls, cat, head, tail, find, echo, touch, mkdir, pwd, cd

FILE CREATION:
- Create file with content: echo "content" > filename
- Create empty file: touch filename
- Create folder: mkdir foldername

EXAMPLES:

User: "switch to master"
**Switching to master.**

[EXECUTE_GIT]git checkout master[/EXECUTE_GIT]

User: "create README with hello world"
**Creating README.md with content.**

[EXECUTE_SHELL]echo "hello world" > README.md[/EXECUTE_SHELL]

User: "create empty file test.txt"
**Creating empty test.txt file.**

[EXECUTE_SHELL]touch test.txt[/EXECUTE_SHELL]

User: "add readme and commit"
**Staging README.md.**

[EXECUTE_GIT]git add README.md[/EXECUTE_GIT]

User: "commit with message initial"
**Committing changes.**

[EXECUTE_GIT]git commit -m "initial"[/EXECUTE_GIT]

User: "show commits"
**Showing recent commits.**

[EXECUTE_GIT]git log --oneline -10[/EXECUTE_GIT]

NEVER write multiple steps. ONE command, then wait.`;
    }

    cleanResponse(text) {
        let cleaned = text
            // Remove internal model tokens
            .replace(/.*?<\|message\|>/gs, '')
            .replace(/<\|[^|]*\|>/g, '')
            .replace(/\|>/g, '')
            .replace(/<\|/g, '')
            .replace(/^(assistant|user|system|final|analysis)[\s:]+/gim, '')
            // Remove JSON objects that the model might output incorrectly
            .replace(/\{"cmd":\[.*?\]\}/g, '')
            .replace(/\{[^{}]*"cmd"[^{}]*\}/g, '')
            // Remove any repeated command execution info the model might echo
            .replace(/\[Command executed:.*?\]/gs, '')
            .replace(/\[SYSTEM:.*?\]/gs, '')
            .replace(/✅ Result:.*$/gm, '')
            .replace(/❌ Result:.*$/gm, '')
            // Clean up extra whitespace
            .replace(/\n{3,}/g, '\n\n')
            .trim();
        
        // If response is mostly cleaned out or too short, provide fallback
        if (!cleaned || cleaned.length < 5) {
            return "I couldn't generate a proper response. Please try rephrasing your question.";
        }
        
        return cleaned;
    }

    clearHistory() {
        this.conversationHistory = [];
    }

    addCommandResult(command, result, success) {
        // Add command execution results to history so the model knows what happened
        // Use a system-like format that the LLM won't repeat back
        this.conversationHistory.push({
            role: 'user',
            content: `[SYSTEM: Command "${command}" was executed. Output: ${result}]`
        });
        this.trimHistory();
    }

    trimHistory() {
        // Keep only the last N messages to avoid context overflow
        if (this.conversationHistory.length > this.maxHistoryLength) {
            this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
        }
    }

    async sendMessage(userMessage, workspaceInfo) {
        const config = this.getConfig();
        
        // Add user message to history
        this.conversationHistory.push({
            role: 'user',
            content: userMessage
        });
        this.trimHistory();

        // Build messages array with system prompt + conversation history
        const messages = [
            {
                role: 'system',
                content: this.getSystemPrompt(workspaceInfo)
            },
            ...this.conversationHistory
        ];

        return new Promise((resolve, reject) => {
            const url = new URL(config.endpoint);
            const isHttps = url.protocol === 'https:';
            const httpModule = isHttps ? https : http;

            const requestBody = JSON.stringify({
                model: config.model,
                messages: messages,
                max_tokens: config.maxTokens,
                temperature: config.temperature
            });

            const options = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(requestBody)
                }
            };

            const req = httpModule.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.choices && response.choices.length > 0 && response.choices[0].message) {
                            const rawText = response.choices[0].message.content;
                            const cleanedText = this.cleanResponse(rawText);
                            
                            // Add assistant response to history
                            this.conversationHistory.push({
                                role: 'assistant',
                                content: cleanedText
                            });
                            this.trimHistory();
                            
                            resolve(cleanedText);
                        } else {
                            reject(new Error('No response from LLM'));
                        }
                    } catch (error) {
                        reject(new Error(`Failed to parse LLM response: ${data}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error(`Failed to connect to LLM: ${error.message}`));
            });

            req.setTimeout(60000, () => {
                req.destroy();
                reject(new Error('Request timeout - LLM took too long to respond'));
            });

            req.write(requestBody);
            req.end();
        });
    }
}

module.exports = { LLMService };
