import * as vscode from 'vscode';
import { exploitFunctions, exploitFunctionMap } from './exploitSignatures';

export class ExploitCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.CompletionItem[] {
        const completions: vscode.CompletionItem[] = [];

        for (const func of exploitFunctions) {
            const item = new vscode.CompletionItem(func.name, vscode.CompletionItemKind.Function);
            item.detail = func.signature;
            item.documentation = new vscode.MarkdownString(
                `**${func.category}**\n\n${func.description}\n\n**Returns:** ${func.returns}`
            );

            // Create snippet for function with parameters
            const snippet = this.createSnippet(func.signature);
            if (snippet) {
                item.insertText = new vscode.SnippetString(snippet);
            }

            completions.push(item);
        }

        return completions;
    }

    private createSnippet(signature: string): string | undefined {
        // Extract parameters from signature
        const match = signature.match(/\(([^)]*)\)/);
        if (!match) {
            return undefined;
        }

        const params = match[1];
        if (!params.trim()) {
            return undefined;
        }

        // Parse parameters
        const paramList = params.split(',').map(p => p.trim());
        let snippetParams = paramList.map((param, index) => {
            const paramName = param.split(':')[0].trim();
            const optional = param.includes('?');
            return optional ? `\${${index + 1}:${paramName}}` : `\${${index + 1}:${paramName}}`;
        }).join(', ');

        return `($snippetParams})`;
    }
}

export class ExploitHoverProvider implements vscode.HoverProvider {
    provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.Hover | undefined {
        const range = document.getWordRangeAtPosition(position);
        if (!range) {
            return undefined;
        }

        const word = document.getText(range);
        const func = exploitFunctionMap.get(word);

        if (!func) {
            return undefined;
        }

        const markdown = new vscode.MarkdownString();
        markdown.appendCodeblock(func.signature, 'luau');
        markdown.appendMarkdown(`**${func.category}**\n\n`);
        markdown.appendMarkdown(`${func.description}\n\n`);
        markdown.appendMarkdown(`**Returns:** ${func.returns}\n\n`);

        if (func.examples && func.examples.length > 0) {
            markdown.appendMarkdown('**Examples:**\n\n');
            for (const example of func.examples) {
                markdown.appendCodeblock(example, 'luau');
            }
        }

        return new vscode.Hover(markdown, range);
    }
}

export class ExploitSignatureHelpProvider implements vscode.SignatureHelpProvider {
    provideSignatureHelp(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.SignatureHelpContext
    ): vscode.SignatureHelp | undefined {
        // Find function name before the opening parenthesis
        const line = document.lineAt(position.line).text;
        const beforeCursor = line.substring(0, position.character);
        const match = beforeCursor.match(/(\w+)\s*\(/);

        if (!match) {
            return undefined;
        }

        const funcName = match[1];
        const func = exploitFunctionMap.get(funcName);

        if (!func) {
            return undefined;
        }

        const signatureHelp = new vscode.SignatureHelp();
        const signature = new vscode.SignatureInformation(func.signature, func.description);

        // Parse parameters
        const paramMatch = func.signature.match(/\(([^)]*)\)/);
        if (paramMatch && paramMatch[1].trim()) {
            const params = paramMatch[1].split(',').map(p => p.trim());
            signature.parameters = params.map(param => {
                const paramName = param.split(':')[0].trim();
                const paramType = param.split(':')[1]?.trim() || 'any';
                return new vscode.ParameterInformation(paramName, paramType);
            });
        }

        signatureHelp.signatures = [signature];
        signatureHelp.activeSignature = 0;

        // Determine which parameter is active
        const commaCount = beforeCursor.substring(beforeCursor.lastIndexOf('(')).split(',').length - 1;
        signatureHelp.activeParameter = Math.min(commaCount, signature.parameters.length - 1);

        return signatureHelp;
    }
}
