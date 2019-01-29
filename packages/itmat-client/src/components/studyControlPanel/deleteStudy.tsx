import * as React from 'react';
import { NavLink } from 'react-router-dom';
import { Mutation } from 'react-apollo';
import { DELETE_STUDY, GET_STUDIES_LIST } from '../../graphql/study';

export const DeleteStudyButton: React.FunctionComponent<{ studyName: string }> = ({ studyName }) => {
    return (
        <div>
            <h3>Delete this study</h3>
            <NavLink to={`/studies/details/${studyName}/delete`}><button>
                Click here
            </button></NavLink>
        </div>
    );
};

export const ReallyDeleteStudy: React.FunctionComponent<{ studyName: string, setDeletedStateHandler: Function }> = ({ studyName, setDeletedStateHandler }) => {
    const [input, setInput] = React.useState('');
    const [inputNotMatched, setInputNotMatched] = React.useState(false);

    function handleDelete(deleteStudy: Function) {
        return function () {
            if (input === studyName) {
                deleteStudy({ variables: { name: studyName } });
            } else {
                setInputNotMatched(true);
            }
        }
    }

    return (
        <>
        <h4>Delete this study</h4>
        <p>WARNING: This is irreversible!</p>
        <p>To confirm deleting this study. Please type the study's name ({studyName}) and click delete.</p>
        <input value={input} onChange={e => { setInputNotMatched(false); setInput(e.target.value); }}/>
        <Mutation
            mutation={DELETE_STUDY}
            update={(cache, { data: { deleteStudy } }) => {
                if (!deleteStudy.successful) return;
                const { getStudies } = cache.readQuery({ query: GET_STUDIES_LIST }) as { getStudies: any[]};
                setDeletedStateHandler(true);
                cache.writeQuery({
                    query: GET_STUDIES_LIST,
                    data: { getStudies: getStudies.filter(el => el.name !== deleteStudy.id) }
                });
            }}
        >
        {(deleteStudy, { loading}) => {
            if (loading) return <button>Delete</button>;
            return <button onClick={handleDelete(deleteStudy)}>Delete</button>;
        }}
        </Mutation>
        { inputNotMatched ? 'Error: Your input does not match the study name.' : null }
        </>

    );
}