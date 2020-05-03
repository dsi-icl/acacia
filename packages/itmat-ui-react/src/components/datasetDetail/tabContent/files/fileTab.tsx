import React, { useState } from 'react';
import { Query } from 'react-apollo';
import { useDropzone } from 'react-dropzone';
import { GET_STUDY } from 'itmat-commons/dist/graphql/study';
import { FileList } from '../../../reusable/fileList/fileList';
import { LoadingBalls } from '../../../reusable/icons/loadingBalls';
import { Subsection } from '../../../reusable/subsection/subsection';
import css from './tabContent.module.css';
import { UploadFileSection } from './uploadFile';

export const FileRepositoryTabContent: React.FunctionComponent<{ studyId: string }> = ({ studyId }) => {

    const [isDropOverlayShowing, setisDropOverlayShowing] = useState(false);

    const onDropLocal = (acceptedFiles: Blob[]) => {

        acceptedFiles.forEach((file: Blob) => {
        });

    };

    const onDragEnter = () => setisDropOverlayShowing(true);
    const onDragOver = () => setisDropOverlayShowing(true);
    const onDragLeave = () => setisDropOverlayShowing(false);
    const onDropAccepted = () => setisDropOverlayShowing(false);
    const onDropRejected = () => setisDropOverlayShowing(false);

    const { getRootProps, getInputProps } = useDropzone({
        noClick: true,
        preventDropOnDocument: true,
        noKeyboard: true,
        onDrop: onDropLocal,
        onDragEnter,
        onDragOver,
        onDragLeave,
        onDropAccepted,
        onDropRejected
    });

    return <div {...getRootProps()} className={`${css.scaffold_wrapper} ${isDropOverlayShowing ? css.drop_overlay : ''}`}>
        <input {...getInputProps()} />
        <div className={css.tab_page_wrapper + ' ' + css.left_panel}>
            <Subsection title="Existing files">
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
            <Subsection title="Upload new file">
                <UploadFileSection studyId={studyId} />
            </Subsection>
        </div>
    </div>;
};
