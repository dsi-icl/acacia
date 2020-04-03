import { IRole } from '@itmat/commons';
import * as React from 'react';
import { Subsection } from '../../../reusable';
import { RoleControlSection } from '../../../reusable/roleControlSection/roleControlSection';
import css from './tabContent.module.css';

export const AdminTabContent: React.FC<{ studyId: string; projectId: string; roles: IRole[] }> = ({ roles, studyId, projectId }) => (
    <div className={css.tab_page_wrapper_grid}>
        <div className={`${css.tab_page_wrapper} ${css.main_page}`}>
            <Subsection title="Roles">
                <RoleControlSection studyId={studyId} projectId={projectId} roles={roles} />
            </Subsection>
        </div>
    </div>
);
