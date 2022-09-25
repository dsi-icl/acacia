import { FunctionComponent } from 'react';
import { useQuery } from '@apollo/client/react/hooks';
import { Route, Routes, useParams, Navigate } from 'react-router-dom';
import { Subsection } from '../../../reusable/subsection/subsection';
import { ProjectDetail } from './detailSections/projectDetail';
import { ProjectListSection, AddNewProject } from './projectListSection';
import LoadSpinner from '../../../reusable/loadSpinner';
import { WHO_AM_I } from '@itmat-broker/itmat-models';
import { userTypes } from '@itmat-broker/itmat-types';
import css from './tabContent.module.css';

export const ProjectsTabContent: FunctionComponent<{ projectList: { id: string; name: string }[] }> = ({ projectList }) => {
    const { studyId } = useParams();
    const { loading: whoAmILoading, error: whoAmIError, data: whoAmIData } = useQuery(WHO_AM_I);
    if (whoAmILoading) {
        return <LoadSpinner />;
    }
    if (!studyId || whoAmIError)
        return <Navigate to='/datasets' />;
    if (whoAmIData.whoAmI.type === userTypes.ADMIN) {
        return <Routes>
            <Route path=':projectId/*' element={<ProjectDetail />} />
            <Route path='/' element={<div className={`${css.tab_page_wrapper} ${css.left_panel} fade_in`}>
                <div>
                    <Subsection title='Projects'>
                        <ProjectListSection studyId={studyId} projectList={projectList} />
                    </Subsection>
                </div>
                <div>
                    <Subsection title='Add new project'>
                        <AddNewProject studyId={studyId} />
                    </Subsection>
                </div>
            </div>} />
            <Route path='*' element={<Navigate to='projects' />} />
        </Routes>;
    } else
        return <Navigate to='projects' />;
};
