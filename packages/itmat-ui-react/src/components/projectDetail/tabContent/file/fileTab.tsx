import * as React from 'react';
import { Query } from '@apollo/client/react/components';
import { GET_PROJECT, studyType } from 'itmat-commons';
import { FileList } from '../../../reusable/fileList/fileList';
import LoadSpinner from '../../../reusable/loadSpinner';
import { Subsection } from '../../../reusable/subsection/subsection';
import css from './tabContent.module.css';

export const FileTabContent: React.FunctionComponent<{ studyId: string; projectId: string }> = ({ projectId }) => {
    return <div className={css.tab_page_wrapper}>
        <Subsection title='Files'>
            <Query<any, any> query={GET_PROJECT} variables={{ projectId, admin: false }}>
                {({ loading, data, error }) => {
                    if (loading) { return <LoadSpinner />; }
                    if (error) { return <p>Error :( {JSON.stringify(error)}</p>; }
                    if (!data || !data.getProject || !data.getProject.files || data.getProject.files.length === 0) {
                        return <p>Seems like there is no file for this project!</p>;
                    }
                    return <FileList type={studyType.SENSOR} files={data.getProject.files} searchTerm={undefined}/>;
                }}
            </Query>

        </Subsection>
    </div>;
};
