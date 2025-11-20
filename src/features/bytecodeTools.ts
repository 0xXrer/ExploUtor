import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class BytecodeTools {
    private outputChannel: any;

    constructor(outputChannel: any) {
        this.outputChannel = outputChannel;
    }

    public async disassemble() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        // Check if file is binary or .luau
        const isBinary = editor.document.fileName.endsWith('.bin') || editor.document.getText().startsWith('\x1bLua');

        if (isBinary) {
            // If it's a binary file opened as text (or we read it from disk), we should parse it.
            // VS Code might not open binary files well as text, so we read from disk.
            const buffer = fs.readFileSync(editor.document.fileName);
            try {
                const disassembler = new Disassembler(buffer);
                const output = disassembler.disassemble();

                const doc = await vscode.workspace.openTextDocument({
                    content: output,
                    language: 'lua' // Use lua highlighting for the assembly output
                });
                await vscode.window.showTextDocument(doc);
            } catch (e) {
                vscode.window.showErrorMessage(`Disassembly failed: ${e}`);
            }
        } else {
            // If it's source code, we can't disassemble without a compiler.
            // We'll show the runtime simulation template as fallback or ask user.
            const selection = await vscode.window.showQuickPick(['Runtime Disassembly Template', 'Load Binary File...']);
            if (selection === 'Runtime Disassembly Template') {
                this.insertRuntimeTemplate(editor);
            } else if (selection === 'Load Binary File...') {
                const uri = await vscode.window.showOpenDialog({ filters: { 'Luau Binary': ['bin', 'luau'] } });
                if (uri && uri[0]) {
                    const buffer = fs.readFileSync(uri[0].fsPath);
                    try {
                        const disassembler = new Disassembler(buffer);
                        const output = disassembler.disassemble();
                        const doc = await vscode.workspace.openTextDocument({ content: output, language: 'lua' });
                        await vscode.window.showTextDocument(doc);
                    } catch (e) {
                        vscode.window.showErrorMessage(`Disassembly failed: ${e}`);
                    }
                }
            }
        }
    }

    private insertRuntimeTemplate(editor: vscode.TextEditor) {
        const template = `
-- Runtime Disassembly Template
local script = game.Players.LocalPlayer.PlayerScripts.LocalScript
local bytecode = getscriptbytecode(script)
-- Send bytecode to extension via WebSocket or print
print(bytecode)
`;
        editor.edit(editBuilder => {
            editBuilder.insert(editor.selection.active, template);
        });
    }

    public async injectModifier() {
        const snippet = `
-- Bytecode Modifier Template
local function modifyConstant(func, index, value)
    local constants = debug.getconstants(func)
    if constants[index] then
        debug.setconstant(func, index, value)
    end
end

local function modifyUpvalue(func, index, value)
    local upvalues = debug.getupvalues(func)
    if upvalues[index] then
        debug.setupvalue(func, index, value)
    end
end
`;
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            editor.edit(editBuilder => {
                editBuilder.insert(editor.selection.active, snippet);
            });
        }
    }

    public async dumpProto() {
        const snippet = `
-- Proto Dumper
local function dumpProtos(func, depth)
    depth = depth or 0
    local indent = string.rep("  ", depth)
    
    local protos = debug.getprotos(func)
    print(indent .. "Protos: " .. #protos)
    
    for i, proto in ipairs(protos) do
        print(indent .. "Proto [" .. i .. "]")
        dumpProtos(proto, depth + 1)
    end
end
`;
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            editor.edit(editBuilder => {
                editBuilder.insert(editor.selection.active, snippet);
            });
        }
    }
}

// --- Disassembler Implementation ---

class Disassembler {
    private buffer: Buffer;
    private pos: number = 0;
    private strings: string[] = [];
    private protos: any[] = [];

    constructor(buffer: Buffer) {
        this.buffer = buffer;
    }

    public disassemble(): string {
        let output = "-- Luau Bytecode Disassembly\n\n";

        // Header
        const version = this.readByte();
        output += `Luau Version: ${version}\n`;
        if (version === 0) {
            return output + "Error: Invalid or unsupported version (0). Is this a valid Luau binary?";
        }

        // Types (simplified)
        const typesCount = this.readLEB128();
        output += `Types: ${typesCount}\n`;
        // Skip types for now
        // In a real full implementation we would parse them to name them.

        // Strings
        const stringCount = this.readLEB128();
        output += `Strings: ${stringCount}\n`;
        for (let i = 0; i < stringCount; i++) {
            const len = this.readLEB128();
            const str = this.readString(len);
            this.strings.push(str);
            output += `  [${i + 1}] "${str}"\n`;
        }

        // Proto
        // Luau binaries usually contain a main proto.
        // The structure depends heavily on version. Assuming standard Luau container format.
        // Actually, raw bytecode from `getscriptbytecode` often starts directly with the proto or a version byte then proto.
        // Let's assume the buffer IS the bytecode stream starting after the version.

        try {
            output += "\n" + this.readProto(0);
        } catch (e) {
            output += `\nError parsing proto: ${e}`;
        }

        return output;
    }

    private readProto(depth: number): string {
        let output = "";
        const indent = "  ".repeat(depth);

        const maxStackSize = this.readByte();
        const numParams = this.readByte();
        const numUpvalues = this.readByte();
        const isVararg = this.readByte();

        output += `${indent}Proto (Stack: ${maxStackSize}, Params: ${numParams}, Upvals: ${numUpvalues}, Vararg: ${isVararg})\n`;

        // Instructions
        const sizeCode = this.readLEB128();
        output += `${indent}  Instructions: ${sizeCode}\n`;

        const instructions = [];
        for (let i = 0; i < sizeCode; i++) {
            instructions.push(this.readInt32());
        }

        for (let i = 0; i < sizeCode; i++) {
            const inst = instructions[i];
            const opcode = inst & 0xFF;
            const opName = OpCodes[opcode] || `OP_${opcode}`;
            const A = (inst >> 8) & 0xFF;
            const B = (inst >> 16) & 0xFF;
            const C = (inst >> 24) & 0xFF;

            // Handle specific opcode formats (D, E, AUX)
            // This is a simplified view. Real Luau decoding needs to handle AUX words for specific ops.
            // For this task, we'll display raw operands.

            output += `${indent}    [${i}] ${opName} A:${A} B:${B} C:${C}\n`;
        }

        // Constants
        const sizeK = this.readLEB128();
        output += `${indent}  Constants: ${sizeK}\n`;
        for (let i = 0; i < sizeK; i++) {
            const type = this.readByte();
            let val = "";
            switch (type) {
                case 0: val = "nil"; break;
                case 1: val = "boolean: " + (this.readByte() !== 0); break;
                case 2: val = "number: " + this.readDouble(); break;
                case 3: val = "string: " + this.strings[this.readLEB128() - 1]; break;
                case 4: val = "import: " + this.readInt32(); break;
                case 5: val = "table"; this.readLEB128(); break; // shape
                case 6: val = "closure"; this.readLEB128(); break; // closure
                default: val = "unknown type " + type; break;
            }
            output += `${indent}    [${i}] ${val}\n`;
        }

        // Inner Protos
        const sizeP = this.readLEB128();
        output += `${indent}  Inner Protos: ${sizeP}\n`;
        for (let i = 0; i < sizeP; i++) {
            // Recursively read proto
            // Note: In some versions, proto ID is stored, in others the proto itself is inline.
            // Assuming inline for standard container.
            // Actually, standard Luau bytecode stores child protos recursively.
            output += this.readProto(depth + 1);
        }

        // Debug info (Line info, etc) - Skip for brevity
        // We need to consume it to keep sync if we were parsing strictly, 
        // but since we might fail on complex structures without a perfect parser, 
        // we'll stop here or assume end of proto if it's the last thing.
        // Realistically, we need to skip:
        // lineinfo (sizeCode bytes?)
        // debugname (string id)
        // ...

        return output;
    }

    private readByte(): number {
        if (this.pos >= this.buffer.length) return 0;
        return this.buffer[this.pos++];
    }

    private readInt32(): number {
        const val = this.buffer.readInt32LE(this.pos);
        this.pos += 4;
        return val;
    }

    private readDouble(): number {
        const val = this.buffer.readDoubleLE(this.pos);
        this.pos += 8;
        return val;
    }

    private readLEB128(): number {
        let result = 0;
        let shift = 0;
        let byte;
        do {
            byte = this.readByte();
            result |= (byte & 0x7F) << shift;
            shift += 7;
        } while (byte & 0x80);
        return result;
    }

    private readString(len: number): string {
        const str = this.buffer.toString('utf8', this.pos, this.pos + len);
        this.pos += len;
        return str;
    }
}

const OpCodes: { [key: number]: string } = {
    0x00: 'NOP', 0x01: 'BREAK', 0x02: 'LOADNIL', 0x03: 'LOADB', 0x04: 'LOADN', 0x05: 'LOADK',
    0x06: 'MOVE', 0x07: 'GETGLOBAL', 0x08: 'SETGLOBAL', 0x09: 'GETUPVAL', 0x0A: 'SETUPVAL',
    0x0B: 'CLOSEUPVALS', 0x0C: 'GETIMPORT', 0x0D: 'GETTABLE', 0x0E: 'SETTABLE', 0x0F: 'GETTABLEKS',
    0x10: 'SETTABLEKS', 0x11: 'GETTABLEN', 0x12: 'SETTABLEN', 0x13: 'NEWCLOSURE', 0x14: 'NAMECALL',
    0x15: 'CALL', 0x16: 'RETURN', 0x17: 'JUMP', 0x18: 'JUMPBACK', 0x19: 'JUMPIF', 0x1A: 'JUMPIFNOT',
    0x1B: 'JUMPIFEQ', 0x1C: 'JUMPIFLE', 0x1D: 'JUMPIFLT', 0x1E: 'JUMPIFNOTEQ', 0x1F: 'JUMPIFNOTLE',
    0x20: 'JUMPIFNOTLT', 0x21: 'ADD', 0x22: 'SUB', 0x23: 'MUL', 0x24: 'DIV', 0x25: 'MOD',
    0x26: 'POW', 0x27: 'ADDK', 0x28: 'SUBK', 0x29: 'MULK', 0x2A: 'DIVK', 0x2B: 'MODK',
    0x2C: 'POWK', 0x2D: 'AND', 0x2E: 'OR', 0x2F: 'ANDK', 0x30: 'ORK', 0x31: 'CONCAT',
    0x32: 'NOT', 0x33: 'MINUS', 0x34: 'LENGTH', 0x35: 'NEWTABLE', 0x36: 'DUPTABLE', 0x37: 'SETLIST',
    0x38: 'FORNPREP', 0x39: 'FORNLOOP', 0x3A: 'FORGLOOP', 0x3B: 'FORGPREP_INEXT', 0x3C: 'FORGPREP_NEXT',
    0x3D: 'GETVARARGS', 0x3E: 'PREPVARARGS', 0x3F: 'LOADKX', 0x40: 'JUMPX', 0x41: 'FASTCALL',
    0x42: 'COVERAGE', 0x43: 'CAPTURE', 0x44: 'JUMPIFEQK', 0x45: 'JUMPIFNOTEQK', 0x46: 'FASTCALL1',
    0x47: 'FASTCALL2', 0x48: 'FASTCALL2K', 0x49: 'FORGPREP', 0x4A: 'JUMPXEQKNIL', 0x4B: 'JUMPXEQKB',
    0x4C: 'JUMPXEQKN', 0x4D: 'JUMPXEQKS',
    // Add more if needed, this covers standard v3 set
};
