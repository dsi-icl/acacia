import * as React from 'react';
import { CREATE_STUDY, GET_STUDIES_LIST} from '../../graphql/study';
import { Mutation } from "react-apollo";
import * as css from '../../css/studyPage.module.css';

export const CreateStudyPage: React.FunctionComponent = props => {
    const [studyNameInput, changeStudyNameInput] = React.useState('');
    const [isUkbiobank, setIsUKBStudy] = React.useState(false);

    return (
        <Mutation
            mutation={CREATE_STUDY}
            refetchQueries={GET_STUDIES_LIST}
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
                            <input type='checkbox' checked={isUkbiobank} onChange={e => { setIsUKBStudy(e.target.checked);}}/>
                            <br/><br/><br/>
                            <button onClick={() => {createStudy({ variables: { name: studyNameInput, isUkbiobank }});}}>Submit</button>

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