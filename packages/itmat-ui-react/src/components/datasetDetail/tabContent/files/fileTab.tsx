import * as React from 'react';
import { Query } from '@apollo/client/react/components';
import { GET_STUDY } from 'itmat-commons';
import { FileList } from '../../../reusable/fileList/fileList';
import { LoadingBalls } from '../../../reusable/icons/loadingBalls';
import { Subsection } from '../../../reusable/subsection/subsection';
import css from './tabContent.module.css';
import { UploadFileSection } from './uploadFile';

export const FileRepositoryTabContent: React.FunctionComponent<{ studyId: string }> = ({ studyId }) => {
    return <div className={css.scaffold_wrapper + ' fade_in'}>
        <div className={css.tab_page_wrapper + ' ' + css.left_panel}>
            <Subsection title='Existing files'>
                <Query<any, any> query={GET_STUDY} variables={{ studyId }}>
                    {({ loading, data, error }) => {
                        if (loading) { return <LoadingBalls />; }
                        if (error) { return <p>{error.toString()}</p>; }
                        if (!data.getStudy || !data.getStudy.files || data.getStudy.files.length === 0) {
                            return <p>There seems to be no files for this study. You can start uploading files.</p>;
                        }
                        return <FileList files={data.getStudy.files} />;
                    }}
                </Query>
            </Subsection>
        </div>
        <div className={css.tab_page_wrapper + ' ' + css.right_panel}>
            <Subsection title='Upload new file'>
                <UploadFileSection studyId={studyId} />
            </Subsection>
        </div>
    </div>;
};
