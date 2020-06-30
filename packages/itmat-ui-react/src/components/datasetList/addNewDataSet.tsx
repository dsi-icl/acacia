import * as React from 'react';
import { Query, useMutation } from 'react-apollo';
import { userTypes, WHO_AM_I, CREATE_STUDY } from 'itmat-commons';
import { Button, Form, Input, Alert } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { Subsection } from '../reusable';

export const AddNewDataSet: React.FunctionComponent = () => {

    const [showMore, setShowMore] = React.useState(false);
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
        <Query<any, any>
            query={WHO_AM_I}
            pollInterval={5000}
        >
            {({ loading, error, data }) => {
                if (loading) { return <p>Loading...</p>; }
                if (error) { return <p>Error :( {error}</p>; }
                if (data.whoAmI && data.whoAmI.type && data.whoAmI.type === userTypes.ADMIN) {
                    return (
                        !showMore ?
                            <Button icon={<PlusOutlined />} type='dashed' onClick={() => setShowMore(true)}>Add new dataset</Button>
                            :
                            <div>
                                <Subsection title='Add new dataset'>
                                    <Form onFinish={(variables) => createStudy({ variables })}>
                                        <Form.Item name='name' >
                                            <Input placeholder='Dataset name' />
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
