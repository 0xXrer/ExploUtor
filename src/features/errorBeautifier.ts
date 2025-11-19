import * as vscode from 'vscode';

export interface BeautifiedError {
    formatted: string;
    errorType: string;
    message: string;
    stackTrace?: string[];
    location?: {
        file?: string;
        line?: number;
    };
}

export class ErrorBeautifier {
    private enabled: boolean = true;

    constructor() {
        this.loadConfiguration();

        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('exploitor.errorBeautifier')) {
                this.loadConfiguration();
            }
        });
    }

    private loadConfiguration(): void {
        const config = vscode.workspace.getConfiguration('exploitor.errorBeautifier');
        this.enabled = config.get<boolean>('enabled', true);
    }

    public beautify(error: string): BeautifiedError {
        if (!this.enabled) {
            return {
                formatted: error,
                errorType: 'Error',
                message: error
            };
        }

        const parsed = this.parseError(error);
        const formatted = this.formatError(parsed);

        return {
            ...parsed,
            formatted
        };
    }

    private parseError(error: string): BeautifiedError {
        // Parse Luau error formats
        const patterns = [
            // Standard Lua error: "filename:line: message"
            /^(.+?):(\d+):\s*(.+)$/,
            // Runtime error: "[string \"...\"]:line: message"
            /^\[string\s+"(.+?)"\]:(\d+):\s*(.+)$/,
            // Stack overflow
            /^(stack overflow)$/i,
            // Attempt to call/index
            /^(attempt to (?:call|index|perform arithmetic on).+)$/i,
        ];

        let errorType = 'Runtime Error';
        let message = error;
        let location: { file?: string; line?: number } | undefined;
        let stackTrace: string[] | undefined;

        // Try to match patterns
        for (const pattern of patterns) {
            const match = error.match(pattern);
            if (match) {
                if (match.length === 4) {
                    // Has file and line
                    location = {
                        file: match[1],
                        line: parseInt(match[2])
                    };
                    message = match[3];
                } else if (match.length === 2) {
                    // Just error message
                    message = match[1];
                }
                break;
            }
        }

        // Detect error type
        if (error.includes('attempt to index')) {
            errorType = 'Index Error';
        } else if (error.includes('attempt to call')) {
            errorType = 'Call Error';
        } else if (error.includes('attempt to perform arithmetic')) {
            errorType = 'Arithmetic Error';
        } else if (error.includes('stack overflow')) {
            errorType = 'Stack Overflow';
        } else if (error.includes('bad argument')) {
            errorType = 'Argument Error';
        } else if (error.includes('syntax error') || error.includes('unexpected symbol')) {
            errorType = 'Syntax Error';
        }

        // Parse stack trace if present
        const lines = error.split('\n');
        if (lines.length > 1) {
            stackTrace = lines.slice(1).filter(line => line.trim().length > 0);
        }

        return {
            formatted: error,
            errorType,
            message,
            location,
            stackTrace
        };
    }

    private formatError(parsed: BeautifiedError): string {
        const lines: string[] = [];

        // Header with error type
        lines.push('═══════════════════════════════════════════════════════════');
        lines.push(`  ${parsed.errorType}`);
        lines.push('═══════════════════════════════════════════════════════════');
        lines.push('');

        // Location if available
        if (parsed.location) {
            lines.push('📍 Location:');
            if (parsed.location.file) {
                lines.push(`   File: ${parsed.location.file}`);
            }
            if (parsed.location.line) {
                lines.push(`   Line: ${parsed.location.line}`);
            }
            lines.push('');
        }

        // Error message
        lines.push('💥 Message:');
        lines.push(`   ${parsed.message}`);
        lines.push('');

        // Stack trace if available
        if (parsed.stackTrace && parsed.stackTrace.length > 0) {
            lines.push('📚 Stack Trace:');
            for (const trace of parsed.stackTrace) {
                lines.push(`   ${trace.trim()}`);
            }
            lines.push('');
        }

        // Suggestions based on error type
        const suggestion = this.getSuggestion(parsed.errorType, parsed.message);
        if (suggestion) {
            lines.push('💡 Suggestion:');
            lines.push(`   ${suggestion}`);
            lines.push('');
        }

        lines.push('═══════════════════════════════════════════════════════════');

        return lines.join('\n');
    }

    private getSuggestion(errorType: string, message: string): string | null {
        const suggestions: { [key: string]: string } = {
            'Index Error': 'Check if the object exists before indexing. Use FindFirstChild() for instances.',
            'Call Error': 'Ensure the variable is a function before calling it. Check for nil values.',
            'Arithmetic Error': 'Verify that all operands are numbers. Check for nil values.',
            'Stack Overflow': 'Check for infinite recursion in your functions.',
            'Argument Error': 'Review the function signature and ensure arguments match expected types.',
            'Syntax Error': 'Review your code syntax. Check for missing parentheses, quotes, or keywords.'
        };

        // Specific suggestions based on message content
        if (message.includes('nil')) {
            return 'The value is nil. Use WaitForChild() or check existence before accessing.';
        }

        return suggestions[errorType] || null;
    }

    public formatToMarkdown(parsed: BeautifiedError): string {
        const lines: string[] = [];

        lines.push(`### ${parsed.errorType}`);
        lines.push('');

        if (parsed.location) {
            lines.push('**Location:**');
            if (parsed.location.file) {
                lines.push(`- File: \`${parsed.location.file}\``);
            }
            if (parsed.location.line) {
                lines.push(`- Line: \`${parsed.location.line}\``);
            }
            lines.push('');
        }

        lines.push('**Message:**');
        lines.push('```');
        lines.push(parsed.message);
        lines.push('```');
        lines.push('');

        if (parsed.stackTrace && parsed.stackTrace.length > 0) {
            lines.push('**Stack Trace:**');
            lines.push('```');
            lines.push(parsed.stackTrace.join('\n'));
            lines.push('```');
            lines.push('');
        }

        const suggestion = this.getSuggestion(parsed.errorType, parsed.message);
        if (suggestion) {
            lines.push('**Suggestion:**');
            lines.push(`> ${suggestion}`);
        }

        return lines.join('\n');
    }
}
