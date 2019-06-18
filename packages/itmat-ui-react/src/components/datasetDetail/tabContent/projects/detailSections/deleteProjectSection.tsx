import React from 'react';

export const DeleteProjectSection: React.FunctionComponent<{ projectId: string, projectName: string }> = ({ projectId, projectName }) => {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const [inputText, setInput] = React.useState('');

    if (!isExpanded) {
        return <span onClick={() => { setIsExpanded(true); setInput(''); } }>Click to delete</span>;
    }

    return <>
        <p>Warning! This is irreversible! If you really want to delete this project, please type the name of the project ({projectName}) below to confirm.</p>
        <input type='text' value={inputText} onChange={e => setInput(e.target.value)}/>
        <span>Really delete this project!</span> <span>Cancel</span>
    </>;
};