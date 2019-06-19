import React from 'react';

export const DeleteProjectSection: React.FunctionComponent<{ projectId: string, projectName: string }> = ({ projectId, projectName }) => {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const [inputText, setInput] = React.useState('');

    if (!isExpanded) {
        return <span style={{ textDecoration: 'underline', cursor: 'pointer' }} onClick={() => { setIsExpanded(true); setInput(''); } }>Click to delete</span>;
    }

    return <>
        <p style={{ color: 'red' }}>Warning! This is irreversible! If you really want to delete this project, please type the name of the project ({projectName}) below to confirm.</p>
        <input type='text' placeholder={projectName} value={inputText} onChange={e => setInput(e.target.value)}/> <br/><br/>
        <button style={{ display: 'inline-block', width: '20%' }}>Really delete this project!</button> <button style={{ display: 'inline-block', width: '20%' }} className='button_grey' onClick={() => setIsExpanded(false)}>Cancel</button>
    </>;
};