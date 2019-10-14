import * as React from 'react';
import { Query } from 'react-apollo';
import { GET_PROJECT } from '../../../../graphql/projects';
import * as css from './tabContent.module.css';
import { Subsection } from '../../../reusable/subsection';
import { LoadingBalls } from '../../../reusable/loadingBalls';
import { FileList } from '../../../reusable/fileList';

export const FileTabContent: React.FunctionComponent<{ studyId: string, projectId: string }> = ({ projectId }) => {
    return <div className={css.tab_page_wrapper}>
        <Subsection title='Files'>
            <Query query={GET_PROJECT} variables={{ projectId, admin: false }}>
                {({ loading, data, error }) => {
                    if (loading) return <LoadingBalls />;
                    if (error) return <p>Error :( {JSON.stringify(error)}</p>;
                    if (!data || !data.getProject || !data.getProject.files || data.getProject.files.length === 0) {
                        return <p>Seems like there is no file for this project!</p>;
                    }
                    return <FileList files={data.getProject.files} />;
                }}
            </Query>

        </Subsection>
    </div>;
};