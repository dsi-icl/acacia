import * as React from 'react';
import { CREATE_STUDY, GET_STUDIES_LIST } from '../../graphql/study';
import { Mutation } from "react-apollo";
import * as css from '../../css/studyPage.css';


export const CreateStudyPage: React.FunctionComponent = props => {
    const [studyNameInput, changeStudyNameInput] = React.useState('');

    return (
        <Mutation
            mutation={CREATE_STUDY}
            update={(cache, { data: { id, successful } }) => {
                const { getStudies } = cache.readQuery({ query: GET_STUDIES_LIST }) as any;
                cache.writeQuery({
                    query: GET_STUDIES_LIST,
                    data: { getStudies: getStudies.concat([ { name: studyNameInput, __typename:'Study' }]) }
                })
            }}
        >
            {(createStudy, { loading, error }) =>
                <div className={css.createStudyPanel}>
                    { loading ? <p> Loading.. </p> :
                        (<>
                            <input onChange={e => {changeStudyNameInput(e.target.value);}} value={studyNameInput}/>
                            <button onClick={() => {createStudy({ variables: { name: studyNameInput }});}}>Submit</button>
                            {error ? <p>{error.message}</p> : null}
                        </>)
                    }
                </div>
            }
        </Mutation>
    );
}