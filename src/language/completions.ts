import * as vscode from 'vscode';
import { exploitFunctions, exploitFunctionMap } from './exploitSignatures';

interface ParsedParameter {
    name: string;
    type: string;
    optional: boolean;
    index: number;
}

class SignatureParser {
    static parseParameters(signature: string): ParsedParameter[] {
        const openParen = signature.indexOf('(');
        const closeParen = signature.lastIndexOf(')');
        
        if (openParen === -1 || closeParen === -1) {
            return [];
        }

        const paramString = signature.substring(openParen + 1, closeParen);
        if (!paramString.trim()) {
            return [];
        }

        const params: ParsedParameter[] = [];
        let currentParam = '';
        let depth = 0;
        let index = 0;

        for (let i = 0; i < paramString.length; i++) {
            const char = paramString[i];
            
            if (char === '{' || char === '(' || char === '[') {
                depth++;
            } else if (char === '}' || char === ')' || char === ']') {
                depth--;
            }

            if (char === ',' && depth === 0) {
                params.push(this.parseSingleParam(currentParam.trim(), index++));
                currentParam = '';
            } else {
                currentParam += char;
            }
        }

        if (currentParam.trim()) {
            params.push(this.parseSingleParam(currentParam.trim(), index));
        }

        return params;
    }

    private static parseSingleParam(param: string, index: number): ParsedParameter {
        const colonIndex = param.indexOf(':');
        if (colonIndex === -1) {
            return {
                name: param,
                type: 'any',
                optional: false,
                index
            };
        }

        const namePart = param.substring(0, colonIndex).trim();
        const typePart = param.substring(colonIndex + 1).trim();
        const optional = namePart.endsWith('?') || typePart.endsWith('?');

        return {
            name: namePart.replace('?', ''),
            type: typePart,
            optional,
            index
        };
    }
}

export class ExploitCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.CompletionItem[] {
        // Basic context check: don't provide completions in comments or strings
        const line = document.lineAt(position.line);
        const linePrefix = line.text.substring(0, position.character);
        
        if (this.isInStringOrComment(linePrefix)) {
            return [];
        }

        const completions: vscode.CompletionItem[] = [];

        for (const func of exploitFunctions) {
            const item = new vscode.CompletionItem(func.name, vscode.CompletionItemKind.Function);
            item.detail = func.signature;
            item.documentation = new vscode.MarkdownString(
                `**${func.category}**\n\n${func.description}\n\n**Returns:** ${func.returns}`
            );

            const params = SignatureParser.parseParameters(func.signature);
            const snippet = this.createSnippet(func.name, params);
            
            if (snippet) {
                item.insertText = new vscode.SnippetString(snippet);
            }

            completions.push(item);
        }

        return completions;
    }

    private isInStringOrComment(text: string): boolean {
        let inString = false;
        let quoteChar = '';
        
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (char === '"' || char === "'") {
                if (!inString) {
                    inString = true;
                    quoteChar = char;
                } else if (char === quoteChar && text[i - 1] !== '\\') {
                    inString = false;
                }
            } else if (char === '-' && text[i + 1] === '-' && !inString) {
                return true; // Comment start
            }
        }
        
        return inString;
    }

    private createSnippet(funcName: string, params: ParsedParameter[]): string {
        if (params.length === 0) {
            return `${funcName}()`;
        }

        const snippetParams = params.map((p, i) => {
            // Handle nested types in snippet
            if (p.type.startsWith('{') && p.type.endsWith('}')) {
                // It's a table type, try to expand it
                const innerContent = p.type.substring(1, p.type.length - 1);
                // Simple heuristic for table keys
                if (innerContent.includes(':')) {
                     return `{\n\t${innerContent.split(',').map(k => {
                        const [key, val] = k.split(':');
                        return `${key.trim()} = \${${i + 1}:${val.trim()}}`;
                     }).join(',\n\t')}\n}`;
                }
            }
            return `\${${i + 1}:${p.name}}`;
        }).join(', ');

        return `${funcName}(${snippetParams})`;
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
        const line = document.lineAt(position.line).text;
        const beforeCursor = line.substring(0, position.character);
        
        // Find the function call we are in
        // This is a simple backward search, could be improved with AST
        let depth = 0;
        let paramIndex = 0;
        let funcEndIndex = -1;

        for (let i = beforeCursor.length - 1; i >= 0; i--) {
            const char = beforeCursor[i];
            
            if (char === ')') depth++;
            else if (char === '(') {
                if (depth > 0) {
                    depth--;
                } else {
                    funcEndIndex = i;
                    break;
                }
            } else if (char === ',' && depth === 0) {
                paramIndex++;
            }
        }

        if (funcEndIndex === -1) {
            return undefined;
        }

        // Extract function name
        const preFunc = beforeCursor.substring(0, funcEndIndex).trim();
        const match = preFunc.match(/[\w.]+$/);
        
        if (!match) {
            return undefined;
        }

        const funcName = match[0];
        const func = exploitFunctionMap.get(funcName);

        if (!func) {
            return undefined;
        }

        const signatureHelp = new vscode.SignatureHelp();
        const signature = new vscode.SignatureInformation(func.signature, func.description);
        
        const params = SignatureParser.parseParameters(func.signature);
        signature.parameters = params.map(p => 
            new vscode.ParameterInformation(`${p.name}: ${p.type}`, p.optional ? 'Optional' : '')
        );

        signatureHelp.signatures = [signature];
        signatureHelp.activeSignature = 0;
        signatureHelp.activeParameter = paramIndex;

        return signatureHelp;
    }
}

