import * as React from 'react';
// import { Mutation, Query } from 'react-apollo';

const ApplicationDetails: React.FunctionComponent = props => {
    return (
        <>
            Admins: {applicationAdmins.map(el => <span key={`Admin_${el}`}>{el}</span>)} <br/>
            Users: {applicationUsers.map(el => <span key={`User_${el}`}>{el}</span>)} <br/>
            Pending approvals: {pendingUserApprovals.map(el => <span key={`User_${el.user}_${el.type}`}>{el.user} | {el.type} </span>)} <br/>
            Approved fields: {approvedFields.map(el => <span key={`User_${el}`}>{el}</span>)}
        </>
    );
};