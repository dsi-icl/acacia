import * as React from 'react';
// import { Mutation } from "react-apollo";
// import * as css from '../../css/studyPage.css';

export const ApplyToApplicationSection: React.FunctionComponent<{ studyName: string }> = ({ studyName }) => {
    return (
        <div>
            <h4>{studyName}</h4>
            <p>You have not been added to this study. Therefore, you cannot view this study.</p><br/>
            <p>You can apply to be added to one of the applications (subsets of the data) of this study by clicking below; this will send a message to the application's admins, study's admins and system admins for approval.</p>
            <br/><br/>
            <h3>Apply to an application</h3> <br/>
            <label>Select an application: </label>
            <select>
                <option>application1</option>
                <option>application2</option>
            </select><br/><br/>
            <button>Apply to the selected application</button>
            <br/><br/><br/>
            <h3>Send a message to the study managers</h3>
            <textarea></textarea>
            <button>Send message</button>
        </div>
    );
}