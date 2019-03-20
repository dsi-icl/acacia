import * as monaco from 'monaco-editor';
import * as React from 'react';
import { Models } from 'itmat-utils';

export class Editor extends React.Component<{ studyName: string, applicationName: string, fieldList: Models.Field.IFieldEntry[]  }> {
    shouldComponentUpdate(nextProps: { studyName: string, applicationName: string }){
        if (nextProps.studyName !== this.props.studyName || nextProps.applicationName !== this.props.applicationName) {
            return true;
        } else {
            return false;
        }
    }

    componentDidMount() {
        monaco.editor.defineTheme('myCustomTheme', {
            base: 'vs-dark', // can also be vs-dark or hc-black
            inherit: true, // can also be false to completely replace the builtin rules
            rules: [
                { token: 'comment', foreground: 'ffa500', fontStyle: 'italic underline' },
                { token: 'comment.js', foreground: '008800', fontStyle: 'bold' },
                { token: 'comment.css', foreground: '0000ff' } // will inherit fontStyle from `comment` above
            ]
        } as any);

        const provider: monaco.languages.CompletionItemProvider = {
            provideCompletionItems: (model: monaco.editor.ITextModel, position: monaco.Position) => {
                var textUntilPosition = model.getValueInRange({startLineNumber: 1, startColumn: 1, endLineNumber: position.lineNumber, endColumn: position.column});

                let suggestions;
                if (/(\s*|\()field\s+"$/.test(textUntilPosition)) {
                    suggestions = this.props.fieldList.map(el => ({ label: el.Field, kind: monaco.languages.CompletionItemKind.Value, documentation: el.Notes, insertText: el.Field })) as any;
                } else if (/\s*field\s+(".+"|\d+)\s+instance\s+$/.test(textUntilPosition)) {
                    const fieldIdx = textUntilPosition.lastIndexOf('field');
                    const fieldDescription: string[] = textUntilPosition.substring(fieldIdx).split(/field|instance/);
                    const field = fieldDescription[1].trim();

                    let filterResult;
                    if (field.substring(0,1) === '"') {
                        const fieldName = field.substring(1, field.length-1);
                        console.log(fieldName, this.props.fieldList);
                        filterResult = this.props.fieldList.filter(el => el.Field === fieldName);
                    } else {
                        const fieldId = parseInt(field);
                        filterResult = this.props.fieldList.filter(el => el.FieldID === fieldId);
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
                        console.log(fieldName, this.props.fieldList);
                        filterResult = this.props.fieldList.filter(el => el.Field === fieldName);
                    } else {
                        const fieldId = parseInt(field);
                        filterResult = this.props.fieldList.filter(el => el.FieldID === fieldId);
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
        };

        monaco.languages.registerCompletionItemProvider('json', provider);

        monaco.editor.create(document.getElementById('container')!, {
            value: [
              this.props.studyName,
              this.props.applicationName,
              '}'
            ].join('\n'),
            language: 'json',
            theme: 'myCustomTheme'
          });
    }

    render() {
        return <div id='container'></div>;
    }
}