import * as React from 'react';
import { CREATE_STUDY, GET_STUDIES_LIST} from '../../graphql/study';
import { Mutation } from "react-apollo";

export const CreateStudyPage: React.FunctionComponent = props => {
    const [studyNameInput, changeStudyNameInput] = React.useState('');
    const [isUkbiobank, setIsUKBStudy] = React.useState(false);

    return (
        <Mutation
            mutation={CREATE_STUDY}
            refetchQueries={GET_STUDIES_LIST}
        >
            {(createStudy, { loading, error }) =>
                <>
                    { loading ? <p> Loading.. </p> :
                        (<>
                            <h4>Create New Study</h4>
                            <label>Enter study name: </label>
                            <input onChange={e => {changeStudyNameInput(e.target.value);}} value={studyNameInput}/>
                            <br/><br/>
                            <button onClick={() => {createStudy({ variables: { name: studyNameInput, isUkbiobank }});}}>Submit</button>

                            <br/><br/>
                            {error ? <p>{error.message}</p> : null}
                        </>)
                    }
                </>
            }
        </Mutation>
    );
}