import { FunctionComponent } from 'react';
import { IRoleQL } from '@itmat-broker/itmat-types';
import { Subsection } from '../../../reusable';
import { RoleControlSection } from '../../../reusable/roleControlSection/roleControlSection';
import css from './tabContent.module.css';
import { useParams } from 'react-router-dom';

export const AdminTabContent: FunctionComponent<{ studyId: string; roles: IRoleQL[] }> = ({ roles, studyId }) => {
    const { projectId } = useParams();
    if (!studyId || !projectId)
        return null;
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


