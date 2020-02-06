import { Models } from 'itmat-commons';
import { IRole } from 'itmat-commons/dist/models/study';
import * as React from 'react';
import { Mutation, Query, useQuery } from 'react-apollo';
import { GET_USERS } from 'itmat-commons/dist/graphql/appUsers';
import { ADD_NEW_ROLE, EDIT_ROLE, REMOVE_ROLE } from 'itmat-commons/src/graphql/permission';
import { GET_PROJECT } from 'itmat-commons/dist/graphql/projects';
import { Subsection, UserListPicker } from '../../../reusable';
import { LoadingBalls } from '../../../reusable/icons/loadingBalls';
import * as css from './tabContent.module.css';
import { RoleControlSection } from '../../../reusable/roleControlSection/roleControlSection';
import { GET_STUDY } from 'itmat-commons/dist/graphql/study';

export const AdminTabContent: React.FunctionComponent<{ studyId: string }> = ({ studyId }) => {
    const { data, loading, error } = useQuery(GET_STUDY, { variables: { studyId }});
    if (loading) { return <LoadingBalls/>; }

    return <div className={css.tab_page_wrapper_grid}>
        <div className={css.tab_page_wrapper + ' ' + css.main_page}>
            <Subsection title='Roles'>
                <RoleControlSection studyId={studyId} roles={data.getStudy.roles}/>
            </Subsection>
        </div>
        <div className={css.tab_page_wrapper + ' ' + css.sub_page}>
            <Subsection title='User Access Log'>
                <div>

                </div>
            </Subsection>
        </div>
    </div>;
};