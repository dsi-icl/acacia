import * as monaco from 'monaco-editor';
import { Models } from 'itmat-utils';

export const theme = {
    base: 'vs-dark', // can also be vs-dark or hc-black
    inherit: true, // can also be false to completely replace the builtin rules
    rules: [
        { token: 'typeKeyword', foreground: 'ffe100' }
    ]
};

export const tokeniser = {
    keywords: [ 'value', 'AND', 'OR', 'any', 'imageExistsFor', 'expr', 'numberOf'],
  
    typeKeywords: [ 'field', 'instance', 'array' ],
  
    operators: [ '=', '>', '<', '<=', '>=', '!=' ],
  
    symbols:  /[=><!~?:&|+\-*\/\^%]+/,
  
    // C# style strings
    escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
  
    // The main tokenizer for our languages
    tokenizer: {
      root: [
        // identifiers and keywords
        [/[a-z_$][\w$]*/, { cases: { '@typeKeywords': 'typeKeyword',
                                     '@keywords': 'keyword',
                                     '@default': 'identifier' } }],
        [/[A-Z][\w\$]*/, 'type.identifier' ],  // to show class names nicely
  
        // whitespace
        { include: '@whitespace' },
  
        // delimiters and operators
        [/[{}()\[\]]/, '@brackets'],
        [/[<>](?!@symbols)/, '@brackets'],
        [/@symbols/, { cases: { '@operators': 'operator',
                                '@default'  : '' } } ],
  
        // @ annotations.
        // As an example, we emit a debugging log message on these tokens.
        // Note: message are supressed during the first load -- change some lines to see them.
        [/@\s*[a-zA-Z_\$][\w\$]*/, { token: 'annotation', log: 'annotation token: $0' }],
  
        // numbers
        [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
        [/0[xX][0-9a-fA-F]+/, 'number.hex'],
        [/\d+/, 'number'],
  
        // delimiter: after number because of .\d floats
        [/[;,.]/, 'delimiter'],
  
        // strings
        [/"([^"\\]|\\.)*$/, 'string.invalid' ],  // non-teminated string
        [/"/,  { token: 'string.quote', bracket: '@open', next: '@string' } ],
  
        // characters
        [/'[^\\']'/, 'string'],
        [/(')(@escapes)(')/, ['string','string.escape','string']],
        [/'/, 'string.invalid']
      ],
  
      string: [
        [/[^\\"]+/,  'string'],
        [/@escapes/, 'string.escape'],
        [/\\./,      'string.escape.invalid'],
        [/"/,        { token: 'string.quote', bracket: '@close', next: '@pop' } ]
      ],
  
      whitespace: [
        [/[ \t\r\n]+/, 'white']
      ]
    },
  };


export function providerFactory(fieldList: Models.Field.IFieldEntry[]): monaco.languages.CompletionItemProvider {
    return (
        {
            provideCompletionItems: (model: monaco.editor.ITextModel, position: monaco.Position) => {
                var textUntilPosition = model.getValueInRange({startLineNumber: 1, startColumn: 1, endLineNumber: position.lineNumber, endColumn: position.column});
        
                let suggestions;
                if (/(\s*|\()field\s+"$/.test(textUntilPosition)) {
                    suggestions = fieldList.map(el => ({
                        label: el.Field,
                        kind: monaco.languages.CompletionItemKind.Value,
                        additionalTextEdits: [{ range: {startLineNumber: position.lineNumber, startColumn: position.column-1, endLineNumber: position.lineNumber, endColumn: position.column}, text: null }],
                        documentation: `Notes: ${el.Notes}\n\nPath: ${el.Path}`,
                        insertText: el.FieldID.toString() })
                    ) as any;
                } else if (/\s*field\s+(".+"|\d+)\s+instance\s+$/.test(textUntilPosition)) {
                    const fieldIdx = textUntilPosition.lastIndexOf('field');
                    const fieldDescription: string[] = textUntilPosition.substring(fieldIdx).split(/field|instance/);
                    const field = fieldDescription[1].trim();
        
                    let filterResult;
                    if (field.substring(0,1) === '"') {
                        const fieldName = field.substring(1, field.length-1);
                        console.log(fieldName, fieldList);
                        filterResult = fieldList.filter(el => el.Field === fieldName);
                    } else {
                        const fieldId = parseInt(field);
                        filterResult = fieldList.filter(el => el.FieldID === fieldId);
                    }
        
                    if (filterResult.length === 1) {
                        const range = (start: number, stop: number, step: number) => Array.from({ length: (stop - start) / step + 1}, (_, i) => start + (i * step));
                        const numberOfInstance = filterResult[0].Instances;
                        console.log(range);
                        suggestions = [...range(0, numberOfInstance - 1, 1).map(el => ({ label: el.toString(), kind: monaco.languages.CompletionItemKind.Value, insertText: el.toString() })), { label: 'any', kind: monaco.languages.CompletionItemKind.Value, insertText: 'any' }];
                    }
                } else if (/\s*field\s+(".+"|\d+)\s+instance\s+\d+\s+array\s+$/.test(textUntilPosition)){
                    const fieldIdx = textUntilPosition.lastIndexOf('field');
                    const fieldDescription: string[] = textUntilPosition.substring(fieldIdx).split(/field|instance/);
                    const field = fieldDescription[1].trim();
        
                    let filterResult;
                    if (field.substring(0,1) === '"') {
                        const fieldName = field.substring(1, field.length-1);
                        console.log(fieldName, fieldList);
                        filterResult = fieldList.filter(el => el.Field === fieldName);
                    } else {
                        const fieldId = parseInt(field);
                        filterResult = fieldList.filter(el => el.FieldID === fieldId);
                    }
        
                    if (filterResult.length === 1) {
                        const range = (start: number, stop: number, step: number) => Array.from({ length: (stop - start) / step + 1}, (_, i) => start + (i * step));
                        const numberOfInstance = filterResult[0].Array;
                        console.log(range);
                        suggestions = [...range(0, numberOfInstance - 1, 1).map(el => ({ label: el.toString(), kind: monaco.languages.CompletionItemKind.Value, insertText: el.toString() })), { label: 'any', kind: monaco.languages.CompletionItemKind.Value, insertText: 'any' }];
                    }
                }
        
                return {
                    suggestions
                };
            },
            triggerCharacters: ['"', ' ']
        }
    );
}
