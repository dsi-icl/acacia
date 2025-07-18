import React, { FunctionComponent, useState, useEffect } from 'react';
import LoadSpinner from '../loadSpinner';
import { trpc } from '../../../utils/trpc';
import { message, Space, Modal, Switch, Typography } from 'antd';
import { enumStudyRoles } from '@itmat-broker/itmat-types';
import { useRef } from 'react';

interface SubsectionProps {
    title: string;
    children: React.ReactNode;
}


const Subsection: React.FC<SubsectionProps> = ({ title, children }) => (
    <div style={{ marginBottom: 16 }}>
        <Typography.Text strong>{title}</Typography.Text>
        <div style={{ marginTop: 8 }}>{children}</div>
    </div>
);

export const CreateGuestRole: FunctionComponent<{ studyId: string; userIds: string[]; onComplete: () => void }> = ({ studyId, userIds, onComplete }) => {
    const hasExecutedRef = useRef(false);

    const createStudyRole = trpc.role.createStudyRole.useMutation({
        onSuccess: () => {
            onComplete(); // Reset the parent state
        },
        onError: () => {
            void message.error('Failed to create guest role');
            onComplete(); // Reset the parent state even on error
        }
    });

    React.useEffect(() => {
        if (hasExecutedRef.current) return; // Prevent duplicate calls

        hasExecutedRef.current = true;

        const guestRoleVariables = {
            studyId: studyId,
            name: 'Guest',
            description: 'Guest role for public study',
            dataPermissions: [
                {
                    fields: [
                        '^.*$'
                    ],
                    dataProperties: {},
                    includeUnVersioned: true,
                    permission: 4
                }
            ],
            studyRole: enumStudyRoles.STUDY_USER,
            users: userIds // Add all users to this role
        };

        createStudyRole.mutate(guestRoleVariables);
    }, []); // Empty dependency array - only run once

    return null;
};

export const DeleteGuestRole: FunctionComponent<{ roleId: string; roleName?: string; onComplete: () => void }> = ({ roleId, roleName = 'Guest', onComplete }) => {
    const hasExecutedRef = useRef(false);

    const deleteStudyRole = trpc.role.deleteStudyRole.useMutation({
        onSuccess: () => {
            onComplete(); // Reset the parent state
        },
        onError: () => {
            void message.error(`Failed to delete role: ${roleName}`);
            onComplete(); // Reset the parent state even on error
        }
    });

    React.useEffect(() => {
        if (hasExecutedRef.current) return; // Prevent duplicate calls

        hasExecutedRef.current = true;

        const deleteRoleVariables = {
            roleId: roleId
        };
        deleteStudyRole.mutate(deleteRoleVariables);
    }, []); // Empty dependency array - only run once

    return null;
};

export const StudyVisibility: FunctionComponent<{ studyId: string }> = ({ studyId }) => {
    const [isVisible, setIsVisible] = useState<boolean>(false);
    const [shouldCreateGuestRole, setShouldCreateGuestRole] = useState<boolean>(false);
    const [shouldDeleteGuestRole, setShouldDeleteGuestRole] = useState<{ roleId: string } | null>(null);

    const [loading, setLoading] = useState<boolean>(false);

    const getStudies = trpc.study.getStudies.useQuery({});
    const getStudyRoles = trpc.role.getStudyRoles.useQuery({ studyId });
    const getUsers = trpc.user.getUsers.useQuery({});

    const editStudyVisibility = trpc.study.editStudyVisibility.useMutation({
        onSuccess: () => {
            setLoading(false);

            // Invalidate and refetch the studies query to update the UI with fresh data
            void getStudies.refetch();
        },
        onError: (error) => {
            // Revert the UI state if the mutation fails
            setIsVisible(prev => !prev);
            setLoading(false);
            Modal.error({
                title: 'Failed to update visibility',
                content: error.message || 'An error occurred while updating study visibility'
            });
        }
    });

    // Get current study to check its visibility status
    const studyData = getStudies.data?.find((study) => study.id === studyId);

    // Set initial visibility based on study data
    useEffect(() => {
        if (studyData) {
            setIsVisible(!!studyData.isPublic);
        }
    }, [studyData]);

    // Handle visibility toggle
    const handleToggle = (newValue: boolean) => {
        const action = newValue ? 'public' : 'private';
        const opposite = newValue ? 'visible to all users' : 'restricted to permitted users only';

        Modal.confirm({
            title: `Change study visibility to ${action}?`,
            content: `Once made ${action}, this study will be ${opposite}. Do you want to continue?`,
            okText: `Yes, make it ${action}`,
            cancelText: 'Cancel',
            onOk: async () => {
                setLoading(true);

                setIsVisible(newValue);

                editStudyVisibility.mutate({
                    studyId,
                    isPublic: newValue
                }, {
                    onSuccess: () => {
                        // If changing to public, trigger guest role creation
                        if (newValue) {
                            setShouldCreateGuestRole(true);
                        }
                        else {
                            // If changing to private, trigger guest role deletion
                            const guestRole = getStudyRoles.data?.find(role => role.name === 'Guest');
                            if (guestRole) {
                                setShouldDeleteGuestRole({ roleId: guestRole.id });
                            }
                        }
                    }
                });
            }
        });
    };

    if (getStudies.isLoading) {
        return <LoadSpinner />;
    }
    if (getStudies.isError) {
        return <>
            An error occured.
        </>;
    }

    return (
        <div className="study-visibility-container">
            <Subsection title="Study Visibility">
                <p>Control who can access this study</p>
                <Switch
                    checked={isVisible}
                    onChange={handleToggle}
                    checkedChildren="Public"
                    unCheckedChildren="Private"
                    loading={loading || editStudyVisibility.isLoading}
                />
                <div style={{ marginTop: 8 }}>
                    <Typography.Text type="secondary">
                        {isVisible
                            ? 'This study is public and visible to all users'
                            : 'This study is private and only visible to permitted users'}
                    </Typography.Text>
                </div>
                <Space direction="vertical" style={{ marginTop: 16 }}>
                    <Typography.Text type="secondary">
                        <strong>Note:</strong> Making a study public will make its metadata visible to all users,
                        but data access will still be controlled by permissions.
                    </Typography.Text>
                </Space>
            </Subsection>

            {/* Conditionally render the role management components */}
            {shouldCreateGuestRole && getUsers.data && (
                <CreateGuestRole
                    studyId={studyId}
                    userIds={getUsers.data.map(user => user.id)}
                    onComplete={() => setShouldCreateGuestRole(false)}
                />
            )}

            {shouldDeleteGuestRole && (
                <DeleteGuestRole
                    roleId={shouldDeleteGuestRole.roleId}
                    roleName="Guest"
                    onComplete={() => setShouldDeleteGuestRole(null)}
                />
            )}
        </div>
    );
};

export default StudyVisibility;

