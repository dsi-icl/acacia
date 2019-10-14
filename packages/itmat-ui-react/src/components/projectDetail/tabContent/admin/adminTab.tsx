import { Models, permissions } from 'itmat-utils';
import * as React from 'react';
import { Query, Mutation } from 'react-apollo';
import { GET_PROJECT } from '../../../../graphql/projects';
import { CREATE_USER, GET_USERS } from '../../../../graphql/appUsers';
import * as css from './tabContent.module.css';
import { NavLink, Redirect } from 'react-router-dom';
import { Subsection, UserListPicker } from '../../../reusable';
import { EDIT_ROLE, ADD_NEW_ROLE, REMOVE_ROLE } from '../../../../graphql/permission';
import { IRole } from 'itmat-utils/dist/models/study';
import { LoadingBalls } from '../../../reusable/loadingBalls';
import { RoleControlSection } from '../../../reusable/roleControlSection';

export const AdminTabContent: React.FunctionComponent<{studyId: string, projectId: string, roles: Models.Study.IRole[] }> = ({ roles, studyId, projectId }) => {
    return <div className={css.tab_page_wrapper_grid}>
        <div className={css.tab_page_wrapper + ' ' + css.main_page}>
            <Subsection title='Roles'>
                <RoleControlSection studyId={studyId} projectId={projectId} roles={roles}/>
            </Subsection>
        </div>
        <div className={css.tab_page_wrapper + ' ' + css.sub_page}>
            <Subsection title='User Access Log'>
                <div>

                </div>
            </Subsection>
        </div>
    </div>
};


