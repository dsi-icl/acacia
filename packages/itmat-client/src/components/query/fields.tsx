import { Models } from 'itmat-utils';
import * as React from 'react';
import { Query } from "react-apollo";
import * as css from '../../css/studyPage.module.css';
import { GET_STUDIES_LIST } from '../../graphql/study';
import { NavLink } from 'react-router-dom';
import { WHO_AM_I } from '../../graphql/user';

export const FieldListSection: React.FunctionComponent<{ fieldList: Models.Field.IFieldEntry[] }> = ({ fieldList }) => {
    return (
        <>
        <h4>Available Fields</h4>
        {fieldList.map(el => <div>{`${el.FieldID}: ${el.Field}`}</div>)}
        </>
    );
};