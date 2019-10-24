/// <reference types="cypress" />

import React from 'react';
import { CreateNewUser } from '../../src/components/users/createNewUser';
import { mount } from 'cypress-react-unit-test';

describe('Unit', function() {
    it('admin can create user (e2e)', function() {
        mount(<CreateNewUser/> as any, 'CreateNewUser');
        cy.contains('Username');

    });
});