import * as monaco from 'monaco-editor';
import * as React from 'react';

export class Editor extends React.Component<{ studyName: string, applicationName: string }> {
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