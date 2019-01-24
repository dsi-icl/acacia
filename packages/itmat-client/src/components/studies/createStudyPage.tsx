import * as React from 'react';
import { CREATE_STUDY, GET_STUDIES_LIST } from '../../graphql/study';
import { Mutation } from "react-apollo";
import * as css from '../../css/studyPage.css';

export const CreateStudyPage: React.FunctionComponent = props => {
    const [studyNameInput, changeStudyNameInput] = React.useState('');
    const [isUKBStudy, setIsUKBStudy] = React.useState(false);

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
                            <h4>Create New Study</h4>
                            <label>Enter study name: </label>
                            <input onChange={e => {changeStudyNameInput(e.target.value);}} value={studyNameInput}/>
                            <br/><br/>
                            <label>Is this a UK Biobank Study?*</label>
                            <input type='checkbox' checked={isUKBStudy} onClick={() => { setIsUKBStudy(!isUKBStudy);}}/>
                            <br/><br/><br/>
                            <button onClick={() => {createStudy({ variables: { name: studyNameInput }});}}>Submit</button>

                            <br/><br/>
                            <p>* This application has built in curation functions for UK Biobank, such as parsing data file and updating field information, eliminating the need to provide such information manually.</p>
                            {error ? <p>{error.message}</p> : null}
                        </>)
                    }
                </div>
            }
        </Mutation>
    );
}