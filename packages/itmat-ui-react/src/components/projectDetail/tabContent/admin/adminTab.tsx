import { Models } from 'itmat-commons';
import * as React from 'react';
import { Subsection } from '../../../reusable';
import { RoleControlSection } from '../../../reusable/roleControlSection/roleControlSection';
import css from './tabContent.module.css';

export const AdminTabContent: React.FunctionComponent<{ studyId: string; projectId: string; roles: Models.Study.IRole[] }> = ({ roles, studyId, projectId }) => {
    return <div className={css.tab_page_wrapper_grid}>
        <div className={css.tab_page_wrapper + ' ' + css.main_page}>
            <Subsection title='Roles'>
                <RoleControlSection studyId={studyId} projectId={projectId} roles={roles} />
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


