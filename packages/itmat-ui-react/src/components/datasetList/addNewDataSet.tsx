import { FunctionComponent, useState } from 'react';
import { Button, Form, Input, Alert, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { Subsection } from '../reusable';
import { trpc } from '../../utils/trpc';
import LoadSpinner from '../reusable/loadSpinner';

export const AddNewDataSet: FunctionComponent = () => {
    const whoAmI = trpc.user.whoAmI.useQuery();
    const createStudy = trpc.study.createStudy.useMutation({
        onSuccess: () => {
            void message.success('Study created successfully');
        },
        onError: () => {
            void message.error('Failed to create study');
        },
        onSettled() {
            setShowMore(false);
        }
    });
    const [showMore, setShowMore] = useState(false);

    if (whoAmI.isLoading) {
        return <LoadSpinner />;
    }

    if (whoAmI.isError) {
        return <p>An error occured.</p>;
    }

    return (
        !showMore ?
            <Button icon={<PlusOutlined />} type='dashed' onClick={() => setShowMore(true)}>Add new dataset</Button>
            :
            <div>
                <Subsection title='Add new dataset'>
                    <Form onFinish={(variables) => { createStudy.mutate({ ...variables }); }}>
                        <Form.Item name='name' >
                            <Input placeholder='Dataset name' />
                        </Form.Item>
                        <Form.Item name='description' >
                            <Input placeholder='Dataset Description' />
                        </Form.Item>
                        {createStudy.isError ? (
                            <>
                                <Alert type='error' message={createStudy.error.message} />
                                <br />
                            </>
                        ) : null}
                        {createStudy.data?.id ? (
                            <>
                                <Alert type='success' message={'All Saved!'} />
                                <br />
                            </>
                        ) : null}
                        <Form.Item>
                            <Button onClick={() => setShowMore(false)}>
                                Cancel
                            </Button>
                            &nbsp;&nbsp;&nbsp;
                            <Button type='primary' disabled={createStudy.isLoading} loading={createStudy.isLoading} htmlType='submit'>
                                Create
                            </Button>
                        </Form.Item>
                    </Form>
                </Subsection>
            </div>
    );

};
