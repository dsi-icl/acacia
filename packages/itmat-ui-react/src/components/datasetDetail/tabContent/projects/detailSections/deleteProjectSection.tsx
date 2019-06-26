import React from 'react';
import { DELETE_PROJECT } from '../../../../../graphql/study';
import { Mutation } from 'react-apollo';

export const DeleteProjectSection: React.FunctionComponent<{ projectId: string, projectName: string }> = ({ projectId, projectName }) => {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const [inputText, setInput] = React.useState('');
    const [error, setError] = React.useState('');

    if (!isExpanded) {
        return <span style={{ textDecoration: 'underline', cursor: 'pointer' }} onClick={() => { setIsExpanded(true); setInput(''); } }>Click to delete</span>;
    }

    return <>
        <p style={{ color: 'red' }}>Warning! This is irreversible! If you really want to delete this project, please type the name of the project ({projectName}) below to confirm.</p>
        <input type='text' placeholder={projectName} value={inputText} onChange={e => { setInput(e.target.value); setError(''); }}/> <br/><br/>
        <Mutation mutation={DELETE_PROJECT}>
        {(deleteProject, { data, loading }) => 
            loading ?
            <button style={{ display: 'inline-block', width: '30%' }}>Loading...</button> : 
            <button onClick={() => {
                    if (inputText !== projectName) {
                        setError('Project name not matched.');
                    } else {
                        deleteProject({ variables: { projectId } });
                    }
                } }
                style={{ display: 'inline-block', width: '30%' }}>Really delete!
            </button> 
        }
        </Mutation><button style={{ display: 'inline-block', width: '30%' }} className='button_grey' onClick={() => setIsExpanded(false)}>Cancel</button>
        <br/>
        { error ? <div className='error_banner'>{error}</div> : null }
    </>;
};