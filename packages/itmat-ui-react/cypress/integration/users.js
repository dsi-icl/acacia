/// <reference types="cypress" />
const { LOGIN_BODY_ADMIN } = require('../fixtures/loginstring');
const { DELETE_USER } = require('../gql/appUsersGql');

describe('User management page', function() {
    it('admin can create user (e2e)', function() {
        /* login via API */
        cy.request('POST', 'http://localhost:3003/graphql', LOGIN_BODY_ADMIN);
        cy.visit('/users');

        /* clicking the create new user button to go to page */
        cy.contains('Create new user', { timeout: 100000 }).click();
        cy.url().should('eq', `${Cypress.config().baseUrl}/users/createNewUser`);

        /* submitting the form */
        const textinputs  = [
            { label: 'Username', value: 'testuser' },
            { label: 'Password', value: 'testpassword' },
            { label: 'Real name', value: 'Test User Chan' },
            { label: 'Organisation', value: 'DSI-ICL' },
            { label: 'Description', value: 'Just a test user.' },
            { label: 'Email', value: 'testing@test.com' },
        ];
        textinputs.forEach(e => {
            cy.get('form').contains(e.label).children('input').type(e.value);
        });
        cy.get('form').contains('Type').children('select').select('System admin');
        cy.contains('Submit').click();

        /* created user should appear in the list of users */
        cy.get('tbody').last().contains('testuser');

        /* the app should redirect to the created user's page */
        cy.url().then(url => {
            expect(url).to.match(new RegExp(`${Cypress.config().baseUrl}/users/(\\w|-)+$`));

            /* delete the user via API */
            const createdUserId = url.substring(url.lastIndexOf('/') + 1);
            cy.request('POST', 'http://localhost:3003/graphql', { query: DELETE_USER, variables: { userId: createdUserId } })
                .its('body.data.deleteUser.successful').should('eq', true);
        });
    });
});