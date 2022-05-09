import * as React from 'react';
import { Route, Routes, useParams, Navigate } from 'react-router-dom';
import { Subsection } from '../../../reusable/subsection/subsection';
import { ProjectDetail } from './detailSections/projectDetail';
import { ProjectListSection, AddNewProject } from './projectListSection';
import css from './tabContent.module.css';

export const ProjectsTabContent: React.FunctionComponent<{ projectList: { id: string; name: string }[] }> = ({ projectList }) => {
    const { studyId } = useParams();
    if (!studyId)
        return <Navigate to='/datasets' />;
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
};
