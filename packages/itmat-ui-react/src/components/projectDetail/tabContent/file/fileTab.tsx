import { FunctionComponent } from 'react';
import { Query } from '@apollo/client/react/components';
import { GET_PROJECT } from '@itmat-broker/itmat-models';
import { FileList } from '../../../reusable/fileList/fileList';
import LoadSpinner from '../../../reusable/loadSpinner';
import { Subsection } from '../../../reusable/subsection/subsection';
import css from './tabContent.module.css';
import { useParams } from 'react-router-dom';
import { IFile, IProject } from '@itmat-broker/itmat-types';

export const FileTabContent: FunctionComponent<{ studyId: string }> = () => {
    const { projectId } = useParams();
    return <div className={css.tab_page_wrapper}>
        <Subsection title='Files'>
            <Query<{ getProject: IProject & { files: IFile[] } }, { projectId?: string, admin: boolean }> query={GET_PROJECT} variables={{ projectId, admin: false }}>
                {({ loading, data, error }) => {
                    if (loading) { return <LoadSpinner />; }
                    if (error) { return <p>Error {JSON.stringify(error)}</p>; }
                    if (!data || !data.getProject || !data.getProject.files || data.getProject.files.length === 0) {
                        return <p>Seems like there is no file for this project!</p>;
                    }
                    return <FileList files={data.getProject.files} searchTerm={undefined} />;
                }}
            </Query>

        </Subsection>
    </div>;
};
