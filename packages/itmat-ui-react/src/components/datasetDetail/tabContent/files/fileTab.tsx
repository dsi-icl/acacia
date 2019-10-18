import * as React from 'react';
import { Query } from 'react-apollo';
import { GET_STUDY } from '../../../../graphql/study';
import { FileList } from '../../../reusable/fileList';
import { LoadingBalls } from '../../../reusable/loadingBalls';
import { Subsection } from '../../../reusable/subsection';
import * as css from './tabContent.module.css';
import { UploadFileSection } from './uploadFile';

export const FileRepositoryTabContent: React.FunctionComponent<{ studyId: string }> = ({ studyId }) => {
    return <div className={css.scaffold_wrapper}>
        <div className={css.tab_page_wrapper + ' ' + css.left_panel}>
            <Subsection title="Existing files">
                <Query query={GET_STUDY} variables={{ studyId }}>
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
            <Subsection title="Upload new file">
                <UploadFileSection studyId={studyId} />
            </Subsection>
        </div>
    </div>;
};
