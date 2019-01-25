import * as React from 'react';
import { Query, Mutation } from 'react-apollo';
import { ADD_USER_TO_STUDY_MANAGERS, REMOVE_USER_FROM_STUDY_MANAGERS } from '../../graphql/studyDetails';
import { GenericUserList } from './genericUserList';

export const StudyManagersSections: React.FunctionComponent<{ studyName: string, listOfManagers: string[] }> = ({ listOfManagers, studyName }) => {
    return <GenericUserList
                mutationToAddUser={ADD_USER_TO_STUDY_MANAGERS}
                mutationToDeleteUser={REMOVE_USER_FROM_STUDY_MANAGERS}
                studyName={studyName}
                listOfUsers={listOfManagers}
                title='Data managers'
                submitButtonString='add user to manager'
            />;
};