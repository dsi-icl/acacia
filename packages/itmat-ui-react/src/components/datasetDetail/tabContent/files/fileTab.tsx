import React, { useState } from 'react';
import { Button, Upload, notification } from 'antd';
import { RcFile } from 'antd/lib/upload';
import { UploadOutlined } from '@ant-design/icons';
import { Query, useApolloClient, useMutation } from 'react-apollo';
import { useDropzone } from 'react-dropzone';
import { GET_STUDY } from 'itmat-commons/dist/graphql/study';
import { UPLOAD_FILE } from 'itmat-commons/dist/graphql/files';
import { FileList } from '../../../reusable/fileList/fileList';
import { LoadingBalls } from '../../../reusable/icons/loadingBalls';
import { Subsection } from '../../../reusable/subsection/subsection';
import css from './tabContent.module.css';
import { ApolloError } from 'apollo-client';

export const FileRepositoryTabContent: React.FunctionComponent<{ studyId: string }> = ({ studyId }) => {

    const [isDropOverlayShowing, setisDropOverlayShowing] = useState(false);
    const [fileList, setFileList] = useState<RcFile[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [description, setDescription] = React.useState('');
    const store = useApolloClient();

    const [uploadFile] = useMutation(UPLOAD_FILE, {
        onCompleted: ({ uploadFile }) => {
            setDescription('');
            const cachedata = store.readQuery({
                query: GET_STUDY,
                variables: { studyId }
            }) as any;
            if (!cachedata)
                return;
            const newcachedata = {
                ...cachedata.getStudy,
                files: [...cachedata.getStudy.files, uploadFile]
            };
            store.writeQuery({
                query: GET_STUDY,
                variables: { studyId },
                data: { getStudy: newcachedata }
            });
        },
        onError: (error: ApolloError) => {
            notification.error({
                message: 'Upload error!',
                description: error.message ?? 'Unknown Error Occurred!',
                placement: 'topRight',
                duration: 0,
            })
        }
    });

    const onDropLocal = (acceptedFiles: Blob[]) => {
        fileFilter(acceptedFiles.map(file => {
            (file as RcFile).uid = `${Math.random()}`;
            return file as RcFile;
        }))
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

    const fileFilter = (files: RcFile[]) => {
        setFileList([...fileList, ...files]);
    }

    const uploadHandler = () => {

        const uploads: Promise<any>[] = [];
        setIsUploading(true);
        fileList.forEach(file => {
            uploads.push(uploadFile({
                variables: {
                    file,
                    studyId,
                    description,
                    fileLength: file.size
                }
            }).then(result => {
                notification.success({
                    message: 'Upload succeeded!',
                    description: `File ${result.data.uploadFile.fileName} was successfully uploaded!`,
                    placement: 'topRight',
                });
            }).catch(error => {
                notification.error({
                    message: 'Upload error!',
                    description: error?.message ?? error ?? 'Unknown Error Occurred!',
                    placement: 'topRight',
                    duration: 0,
                });
            }));
        });

        Promise.all(uploads).then(() => {
            setIsUploading(false);
        })
    };

    const uploaderProps = {
        onRemove: (file) => {
            const target = fileList.indexOf(file);
            setFileList(fileList.splice(0, target).concat(fileList.splice(target + 1)))
        },
        beforeUpload: (file) => {
            fileFilter([file]);
            return true;
        },
        fileList,
    };

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
                <Upload {...uploaderProps}>
                    <Button>Select File</Button>
                </Upload>
                <Button
                    icon={<UploadOutlined />}
                    type="primary"
                    onClick={uploadHandler}
                    disabled={fileList.length === 0}
                    loading={isUploading}
                    style={{ marginTop: 16 }}
                >
                    {isUploading ? 'Uploading' : 'Upload'}
                </Button>
            </Subsection>
        </div>
    </div>;
};
