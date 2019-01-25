import * as React from 'react';
import { SHORTCUTS_LIST, ADD_SHORT_CUT, REMOVE_SHORT_CUT } from '../../graphql/user';
import { Query, Mutation } from 'react-apollo';
import { IShortCut } from 'itmat-utils/dist/models/user';

export const AddOrDeleteShortCut: React.FunctionComponent<{studyName: string, applicationName?: string}> = ({ studyName, applicationName }) => {
    return (
        <>
        <h4>ADD SHORTCUT</h4>
        <Query query={SHORTCUTS_LIST}>
            {({ data, loading, error }) => {
                if (loading) return null;
                if (!data || !data.whoAmI) return null;
                
                let filteredList: IShortCut[];
                if (applicationName){
                    filteredList = data.whoAmI.shortcuts.filter((el: IShortCut) => el.study === studyName && el.application === applicationName);
                } else {
                    filteredList = data.whoAmI.shortcuts.filter((el: IShortCut) => el.study === studyName && (el.application === undefined || el.application === null) );
                }

                if (filteredList.length >= 1) {
                    return (
                        <Mutation mutation={REMOVE_SHORT_CUT}>
                            {(removeShortCut, { loading}) => {
                                if (loading) return <button>Remove</button>;

                                return <button onClick={() => removeShortCut({ variables: { shortCutId: filteredList[0].id }})}>Remove</button>;
                            }}
                        </Mutation>
                    );
                } else {
                    return (
                        <Mutation mutation={ADD_SHORT_CUT}>
                            {(addShortcut, { loading}) => {
                                if (loading) return <button>Add</button>;
                                const variables: any = { study: studyName };
                                if (applicationName) variables.application = applicationName;

                                return <button onClick={() => addShortcut({ variables })}>Add</button>;
                            }}
                        </Mutation>
                    );
                }
            }}
        </Query>
        </>
    );
};
