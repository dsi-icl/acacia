import { FunctionComponent, useState } from 'react';
import { Query } from '@apollo/client/react/components';
import { useMutation } from '@apollo/client/react/hooks';
import { WHO_AM_I, CREATE_STUDY } from '@itmat-broker/itmat-models';
import { userTypes, studyType } from '@itmat-broker/itmat-types';
import { Button, Form, Input, Alert, Select } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { Subsection } from '../reusable';
const { Option } = Select;

export const AddNewDataSet: FunctionComponent = () => {

    const [showMore, setShowMore] = useState(false);
    const [createStudy, {
        data: createStudyData,
        loading: createStudyLoading,
        error: createStudyError
    }] = useMutation(CREATE_STUDY, {
        onCompleted: () => { setShowMore(false); },
        refetchQueries: [{ query: WHO_AM_I }],
        onError: () => { return; }
    });

    return (
        <Query<any, any> query={WHO_AM_I}>
            {({ loading, error, data }) => {
                if (loading) { return <p>Loading...</p>; }
                if (error) { return <p>Error {error.name}: {error.message}</p>; }
                if (data.whoAmI && data.whoAmI.type && data.whoAmI.type === userTypes.ADMIN) {
                    return (
                        !showMore ?
                            <Button icon={<PlusOutlined />} type='dashed' onClick={() => setShowMore(true)}>Add new dataset</Button>
                            :
                            <div>
                                <Subsection title='Add new dataset'>
                                    <Form onFinish={async (variables) => createStudy({ variables })}>
                                        <Form.Item name='name' >
                                            <Input placeholder='Dataset name' />
                                        </Form.Item>
                                        <Form.Item name='description' >
                                            <Input placeholder='Dataset Description' />
                                        </Form.Item>
                                        <Form.Item name='type' >
                                            <Select
                                                placeholder='Dataset Type'
                                                allowClear
                                            >
                                                <Option value={studyType.SENSOR}>SENSOR</Option>
                                                <Option value={studyType.CLINICAL}>CLINICAL</Option>
                                                <Option value={studyType.ANY}>ANY</Option>
                                            </Select>
                                        </Form.Item>
                                        {createStudyError ? (
                                            <>
                                                <Alert type='error' message={createStudyError?.graphQLErrors.map(error => error.message).join()} />
                                                <br />
                                            </>
                                        ) : null}
                                        {createStudyData?.successful ? (
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
                                            <Button type='primary' disabled={createStudyLoading} loading={createStudyLoading} htmlType='submit'>
                                                Create
                                            </Button>
                                        </Form.Item>
                                    </Form>
                                </Subsection>
                            </div>
                    );
                } else {
                    return null;
                }
            }}
        </Query>
    );
};
