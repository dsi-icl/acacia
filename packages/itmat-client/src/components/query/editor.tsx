import * as monaco from 'monaco-editor';
import * as React from 'react';

export class Editor extends React.Component {
    componentDidMount() {
        monaco.editor.create(document.getElementById('container')!, {
            value: [
              'function x() {',
              '\tconsole.log("Hello world!");',
              '}'
            ].join('\n'),
            language: 'javascript'
          });
    }

    render() {
        return <div id='container'></div>;
    }
}